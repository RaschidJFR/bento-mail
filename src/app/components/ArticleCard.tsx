'use client';
import type { IArticle } from '@lib/models';
import { Card } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Calendar, ExternalLink, Loader2, Heart, X, Flag, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from './utils';

interface ArticleCardProps {
  article: IArticle;
}

function isProcessed(article: IArticle) {
  return !!article.summaries?.oneliner && !!article.summaries?.overview && !!article.summaries?.details;
}

export const ArticleCard = ({ article }: ArticleCardProps) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [liveArticle, setLiveArticle] = useState(article);
  const [isLiked, setIsLiked] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [isFlagged, setIsFlagged] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
  };

  const handleRemove = () => {
    setIsRemoved(true);
  };

  const handleFlag = () => {
    setIsFlagged(!isFlagged);
  };

  const handleProcess = () => {
    setIsProcessing(true);
    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
    }, 2000);
  };

  if (isRemoved) {
    return null;
  }

  return (
    <Card className={`relative overflow-hidden bg-surface-elevated border-border hover:border-brand-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-brand-primary/10 group ${
      isLiked || isFlagged || isProcessing ? 'opacity-60' : ''
    }`}>
      {/* Processing overlay */}
      {!isProcessed(liveArticle) && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="flex items-center gap-2 text-brand-primary">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm font-medium">This article is being processed...</span>
          </div>
        </div>
      )}

      {/* Clickable area to toggle details */}
      <div className={isDetailsOpen ? '' : 'cursor-pointer'} onClick={() => setIsDetailsOpen(true)}>
        {/* Cover Image */}
        {liveArticle.coverImg && (
          <div className="aspect-video w-full overflow-hidden bg-surface-secondary">
            <img src={liveArticle.coverImg} alt={liveArticle.header} className="w-full h-full object-contain" />
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-text-headline leading-tight group-hover:text-brand-primary transition-colors duration-200">
              {liveArticle.summaries?.oneliner || liveArticle.header}
            </h2>
            
            <div className="text-xs text-muted-foreground font-mono">
              ID: {liveArticle._id}
            </div>

            <div className="flex items-center gap-3 text-sm text-text-meta">
              {liveArticle.sourceName && (
                <Badge variant="secondary" className="bg-brand-primary/10 text-brand-primary border-brand-primary/20">
                  {liveArticle.sourceName}
                </Badge>
              )}
              {liveArticle.date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(liveArticle.date)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Overview & Details */}
          <div className="transition-all duration-300 hover:text-brand-primary/80">
            {/* Overview with fade effect when collapsed */}
            <div className="relative">
              <p className="text-text-body leading-relaxed transition-all duration-300">
                {liveArticle.summaries?.overview || ''}
              </p>
            </div>

            {/* Details with smooth animation */}
            <div
              className={`transition-all duration-300 ease-out ${
                isDetailsOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0 overflow-hidden'
              }`}
            >
              <div className="pt-3 border-t border-border/50">
                <p className="text-text-meta text-sm leading-relaxed">{liveArticle.summaries?.details || ''}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Read Full Article Link & Action Buttons */}
      <div className="p-2 pr-6 pl-6 border-t border-border/50">
        <div className="flex items-center justify-between w-full">
          {liveArticle.url && (
            <a
              href={liveArticle.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-accent transition-colors font-medium text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <div>Read full article</div>
            </a>
          )}
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={`flex items-center gap-1 ${isLiked ? 'text-red-500' : 'text-muted-foreground'} hover:text-red-500 px-2`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="flex items-center gap-1 text-muted-foreground hover:text-red-600 px-2"
            >
              <X className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFlag}
              className={`flex items-center gap-1 ${isFlagged ? 'text-orange-500' : 'text-muted-foreground'} hover:text-orange-500 px-2`}
            >
              <Flag className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleProcess}
              disabled={isProcessing}
              className="flex items-center gap-1 text-muted-foreground hover:text-blue-500 px-2"
            >
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
