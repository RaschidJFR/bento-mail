import { INewsletter, IArticle } from '@lib/models';
import { NewsletterHeader } from '@components/NewsletterHeader';
import { ArticleCard } from '@components/ArticleCard';

export function NewsletterDisplay({ newsletter }: { newsletter: INewsletter }) {
  return (
    <section className="mb-12">
      <NewsletterHeader newsletter={newsletter} />
      <div className="space-y-6">
        {newsletter.articles?.length ? (
          (newsletter.articles as IArticle[]).map((article) => <ArticleCard key={article._id} article={article} />)
        ) : (
          <p className="text-center text-muted-foreground">No articles available.</p>
        )}
      </div>
    </section>
  );
}
