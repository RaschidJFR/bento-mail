'use client';
import type { INewsletter, IArticle } from '@lib/models/types';
import { NewsletterHeader } from './NewsletterHeader';
import { ArticleCard } from './ArticleCard';
import { ReactionsEnum } from '@lib/models/enums';
import { useEffect } from 'react';
import { ITaskArticleProcess, useTasks } from '@app/hooks/useTasks';
import { socket } from '@app/hooks/getSocket';
import { useArticles } from '@app/hooks/useArticles';

export function NewsletterDisplay({
  newsletter,
  userId,
  reactionMap,
  tasks: initialTasks,
}: {
  newsletter: INewsletter;
  userId?: string;
  reactionMap?: Map<string, ReactionsEnum>;
  tasks?: ITaskArticleProcess[];
}) {
  const [articles, setArticles] = useArticles(newsletter);
  const [jobMap] = useTasks(newsletter._id, initialTasks || []);

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
              job={jobMap?.get(article._id)}
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
