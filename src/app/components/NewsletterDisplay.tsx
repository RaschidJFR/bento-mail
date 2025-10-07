import type { INewsletter, IArticle } from '@lib/models';
import { NewsletterHeader } from '@components/NewsletterHeader';
import { ArticleCard } from '@components/ArticleCard';
import { ReactionsEnum } from '@lib/models/enums';

export function NewsletterDisplay({
  newsletter,
  userId,
  reactionMap,
}: {
  newsletter: INewsletter;
  userId?: string;
  reactionMap?: Map<string, ReactionsEnum>;
}) {
  return (
    <section className="mb-12">
      <NewsletterHeader newsletter={newsletter} />
      <div className="space-y-6">
        {newsletter.articles?.length ? (
          (newsletter.articles as IArticle[]).map((article) => (
            <ArticleCard key={article._id} article={article} userId={userId} reaction={reactionMap?.get(article._id)} />
          ))
        ) : (
          <p className="text-center text-muted-foreground">No articles available.</p>
        )}
      </div>
    </section>
  );
}
