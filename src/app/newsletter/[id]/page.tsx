import { notFound } from 'next/navigation';
import { Newsletter, IArticle, INewsletter } from '@lib/models';
import { NewsletterHeader } from '@components/NewsletterHeader';
import { ArticleCard } from '@components/ArticleCard';

export const dynamic = 'force-dynamic';

async function getNewsletterArticles(id: string) {
  // Use mock data if DB is not connected
  if (Newsletter.db.readyState != 1) {
    console.warn('Database not connected, using mock newsletter articles');
    return null;
  }

  const newsletter = await Newsletter.findById(id)
    .populate({
      path: 'articles',
      match: { $or: [{ lastError: '' }, { lastError: { $exists: false } }] },
      options: { sort: { sourceName: 1, date: -1 } },
    })
    .lean();

  if (!newsletter) return null;

  const articles = (newsletter.articles || []) as IArticle[];

  return {
    newsletter,
    articles,
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getNewsletterArticles(id);
  if (!data) return notFound();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <NewsletterHeader newsletter={data.newsletter as INewsletter} />

        <main>
          <div className="space-y-6">
            {(data.articles || []).map((article) => (
              <ArticleCard key={article._id} article={article} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
