'use client'
import type { INewsletter, IArticle } from '@lib/models/types';
import { NewsletterHeader } from './NewsletterHeader';
import { ArticleCard } from './ArticleCard';
import { ReactionsEnum } from '@lib/models/enums';
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

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

  useEffect(() => {
    // TODO: is there a way to filter events by id?
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4001');
    const handler = (data: Partial<IArticle>) => {
      setArticles((prev) =>
        prev.map((article) =>
          article._id === data._id
            ? { ...article, ...data }
            : article
        )
      );
    };
    socket.on('articleUpdated', handler);
    return () => {
      socket.off('articleUpdated', handler);
      socket.disconnect();
    };
  }, []);

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
