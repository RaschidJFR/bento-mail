'use client';
import type { IArticle } from '@lib/models/types';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import {
  Calendar,
  ExternalLink,
  Loader2,
  CircleCheckBig,
  ThumbsDown,
  Flag,
  RefreshCw,
  AlertCircle,
  Share,
  ChevronDown,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatDate, normalizeImageUrl } from './utils';
import { ReactionsEnum } from '@lib/models/enums';
import { isTaskActive, ITaskArticleProcess } from '@app/hooks/useTasks';

interface ArticleCardProps {
  article: IArticle;
  userId?: string;
  reaction?: ReactionsEnum;
  job?: ITaskArticleProcess;
  showToolbar?: boolean;
  onRemove?: (articleId: string) => void;
}

async function upsertReaction({
  userId,
  articleId,
  reaction,
}: {
  userId: string;
  articleId: string;
  reaction: ReactionsEnum;
}) {
  const res = await fetch('/api/reaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: userId, article: articleId, reaction }),
  });
  if (!res.ok) throw new Error('Failed to upsert reaction');
  return await res.json();
}

export const ArticleCard = ({
  article: initialArticle,
  userId,
  reaction,
  job: initialJob,
  showToolbar = true,
  onRemove,
}: ArticleCardProps) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(reaction === ReactionsEnum.UPVOTE);
  const [isSkip, setIsSkip] = useState(reaction === ReactionsEnum.SKIP);
  const [isFlagged, setIsFlagged] = useState(reaction === ReactionsEnum.PROBLEM);
  const [isProcessing, setIsProcessing] = useState(initialJob && isTaskActive(initialJob));
  const [isRemoving, setIsRemoving] = useState(false);
  const [job, setJob] = useState(initialJob);
  const [article, setArticle] = useState(initialArticle);
  const [showCopied, setShowCopied] = useState('');

  useEffect(() => {
    setArticle(initialArticle);
  }, [initialArticle]);

  useEffect(() => {
    setJob(initialJob);
  }, [initialJob]);

  useEffect(() => {
    setIsProcessing(!!job && isTaskActive(job));
  }, [job]);

  const handleLike = async () => {
    setIsLiked(!isLiked);
    setIsFlagged(false);
    setIsSkip(false);
    setIsRemoving(!isLiked);
    if (userId) {
      await upsertReaction({
        userId,
        articleId: article._id,
        reaction: isLiked ? ReactionsEnum.ACKNOWLEDGED : ReactionsEnum.UPVOTE,
      });
    }
    // Remove article after animation
    if (!isLiked) {
      setTimeout(() => {
        onRemove?.(article._id);
      }, 300);
    }
  };

  const handleSkip = async () => {
    setIsLiked(false);
    setIsFlagged(false);
    setIsSkip(!isSkip);
    setIsRemoving(!isSkip);
    if (userId) {
      await upsertReaction({
        userId,
        articleId: article._id,
        reaction: isSkip ? ReactionsEnum.ACKNOWLEDGED : ReactionsEnum.SKIP,
      });
    }
    // Remove article after animation
    if (!isSkip) {
      setTimeout(() => {
        onRemove?.(article._id);
      }, 300);
    }
  };

  const handleFlag = async () => {
    setIsLiked(false);
    setIsFlagged(!isFlagged);
    setIsSkip(false);
    setIsRemoving(!isFlagged);
    if (userId) {
      await upsertReaction({
        userId,
        articleId: article._id,
        reaction: isFlagged ? ReactionsEnum.ACKNOWLEDGED : ReactionsEnum.PROBLEM,
      });
    }
    // Remove article after animation
    if (!isFlagged) {
      setTimeout(() => {
        onRemove?.(article._id);
      }, 300);
    }
  };

  const handleProcess = async () => {
    try {
      setIsProcessing(true);
      const res = await fetch(`/api/article/${article._id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (!res.ok) throw new Error('Failed to process article');
      // UI will update via props
      const task = (await res.json()) as ITaskArticleProcess;
      setJob(task);
    } catch (err) {
      setIsProcessing(false);
      console.error(err);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/article/${article._id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowCopied('Link copied!');
    } catch (err) {
      setShowCopied('Failed to copy link!');
    } finally {
      setTimeout(() => setShowCopied(''), 2000);
    }
  };

  return (
    <Card>
      {/* Error banner */}
      {article.lastError && !isProcessing && (
        <div className="bg-destructive/10 border-l-4 border-destructive p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-destructive mb-1">Processing Error:</h3>
              <p className="text-sm text-destructive/90">{article.lastError}</p>
            </div>
          </div>
        </div>
      )}
      {/* Main content area */}
      <div
        className={`relative overflow-hidden bg-surface-elevated border-border 
        transition-all duration-300 max-h-[200vh]
        hover:border-brand-primary/30 hover:shadow-lg hover:shadow-brand-primary/10 group 
        ${isLiked || isSkip || isFlagged || isProcessing ? 'opacity-60' : ''} 
      `}
        style={isRemoving ? { maxHeight: 0, opacity: 0 } : {}}
      >
        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="flex items-center gap-2 text-brand-primary">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm font-medium">This article is being processed...</span>
            </div>
          </div>
        )}

        {/* Clickable area to toggle details */}
        <div
          className={isDetailsOpen ? '' : 'cursor-pointer hover:bg-surface-secondary/30 transition-colors duration-200'}
          onClick={() => !isDetailsOpen && setIsDetailsOpen(true)}
        >
          {/* Cover Image */}
          {article.coverImg && (
            <div className="aspect-video w-full overflow-hidden bg-surface-secondary">
              <img
                src={normalizeImageUrl(article.coverImg, article.url)}
                alt={article.header}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="p-6 space-y-4">
            {/* Header */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-text-headline leading-tight group-hover:text-brand-primary transition-colors duration-200">
                {article.header || article.summaries?.oneliner}
              </h2>

              <div className="text-xs text-muted-foreground font-mono">ID: {article._id}</div>

              <div className="flex items-center gap-3 text-sm text-text-meta">
                {article.sourceName && (
                  <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary border-brand-primary/20">
                    {article.sourceName}
                  </Badge>
                )}
                {article.date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(article.date)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Overview & Details */}
            <div className="transition-all duration-300">
              {/* Overview with fade effect when collapsed */}
              <div className="relative">
                <p className="text-text-body leading-relaxed transition-all duration-300">
                  {article.summaries?.overview || ''}
                </p>

                {/* Expand indicator - only shown when details are collapsed */}
                {!isDetailsOpen && article.summaries?.details && (
                  <div className="flex items-center justify-center mt-3">
                    <button
                      className="w-8 h-8 rounded-full bg-brand-primary/10 hover:bg-brand-primary/20 flex items-center justify-center transition-all duration-200 hover:scale-110"
                      aria-label="Expand details"
                    >
                      <ChevronDown className="w-4 h-4 text-brand-primary" />
                    </button>
                  </div>
                )}
              </div>

              {/* Details with smooth animation */}
              <div
                className={`transition-all duration-300 ease-out ${
                  isDetailsOpen ? 'mt-4' : 'max-h-0 opacity-0 overflow-hidden'
                }`}
              >
                <div className="pt-3 border-t border-border/50">
                  <p className="text-text-meta text-sm leading-relaxed">{article.summaries?.details || ''}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Read Full Article Link & Action Buttons */}
      <div className="p-2 pr-6 pl-6 border-t border-border/50">
        <div className="flex items-center justify-between w-full">
          <div className="flex-1">
            {article.url && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-accent transition-colors font-medium text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <div>Read full article</div>
              </a>
            )}
          </div>

          {/* Action Buttons */}
          {showToolbar !== false && (
            <TooltipProvider>
              <div className="flex items-center gap-1 ml-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLike}
                      className={`flex items-center gap-1 ${
                        isLiked ? 'text-brand-primary' : 'text-muted-foreground'
                      } hover:text-brand-primary/80 hover:bg-slate-700 px-2`}
                    >
                      <CircleCheckBig className={`w-4 h-4`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mark as read</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSkip}
                      className={`flex items-center gap-1 ${
                        isSkip ? 'text-brand-primary fill-current' : 'text-muted-foreground'
                      } hover:text-brand-primary/80 hover:bg-slate-700 px-2`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Not relevant</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleFlag}
                      className={`flex items-center gap-1 ${
                        isFlagged ? 'text-brand-primary' : 'text-muted-foreground'
                      } hover:text-brand-primary/80 hover:bg-slate-700 px-2`}
                    >
                      <Flag className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Report problem</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleProcess}
                      disabled={isProcessing}
                      className="flex items-center gap-1 text-muted-foreground hover:text-brand-primary/80 hover:bg-slate-700 px-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reprocess article</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip open={showCopied ? true : undefined}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleShare}
                      className="flex items-center gap-1 text-muted-foreground hover:text-brand-primary/80 hover:bg-slate-700 px-2"
                    >
                      <Share className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className={showCopied ? 'bg-pink-600 text-white' : ''}>
                    <p>{showCopied || 'Copy link'}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>
    </Card>
  );
};
