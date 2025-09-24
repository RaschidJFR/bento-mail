'use client';
import type { IArticle } from '@lib/models';
import { Card } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Calendar, ExternalLink } from 'lucide-react';
import { useState } from 'react';

interface ArticleCardProps {
  article: IArticle;
}

export const ArticleCard = ({ article }: ArticleCardProps) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className="overflow-hidden bg-surface-elevated border-border hover:border-brand-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-brand-primary/10 group">
      {/* Clickable area to toggle details */}
      <div className="cursor-pointer" onClick={() => setIsDetailsOpen(!isDetailsOpen)}>
        {/* Cover Image */}
        {article.coverImg && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={article.coverImg}
              alt={article.header}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-text-headline leading-tight group-hover:text-brand-primary transition-colors duration-200">
              {article.summaries.oneliner || article.header}
            </h2>

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
          <div className="transition-all duration-300 hover:text-brand-primary/80">
            {/* Overview with fade effect when collapsed */}
            <div className="relative">
              <p className="text-text-body leading-relaxed transition-all duration-300">{article.summaries.overview}</p>
            </div>

            {/* Details with smooth animation */}
            <div
              className={`transition-all duration-300 ease-out ${
                isDetailsOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0 overflow-hidden'
              }`}
            >
              <div className="pt-3 border-t border-border/50">
                <p className="text-text-meta text-sm leading-relaxed">{article.summaries.details}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Read Full Article Link */}
      {article.url && (
        <div className="p-2 pr-6 pl-6 border-t border-border/50">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-accent transition-colors font-medium text-sm w-full"
          >
            <ExternalLink className="w-4 h-4" />
            <div>Read full article</div>
          </a>
        </div>
      )}
    </Card>
  );
};
