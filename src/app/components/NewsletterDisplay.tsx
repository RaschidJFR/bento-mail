'use client'
import type { INewsletter, IArticle } from '@lib/models/types';
import { NewsletterHeader } from './NewsletterHeader';
import { ArticleCard } from './ArticleCard';
import { ReactionsEnum } from '@lib/models/enums';
import { useState } from 'react';

export function NewsletterDisplay({
  newsletter,
  userId,
  reactionMap,
}: {
  newsletter: INewsletter;
  userId?: string;
  reactionMap?: Map<string, ReactionsEnum>;
}) {
  const [articles, setArticles] = useState<IArticle[]>((newsletter.articles as IArticle[]) || []);

  const handleRemoveArticle = (articleId: string) => {
    setArticles((prev) => prev.filter((article) => article._id !== articleId));
  };

  return (
    <section className="mb-12">
      <NewsletterHeader newsletter={newsletter} />
      <div className="space-y-6">
        {articles.length ? (
          articles.map((article) => (
            <ArticleCard
              key={article._id}
              article={article}
              userId={userId}
              reaction={reactionMap?.get(article._id)}
              onRemove={handleRemoveArticle}
            />
          ))
        ) : (
          <p className="text-center text-muted-foreground">No articles available.</p>
        )}
      </div>
    </section>
  );
}
