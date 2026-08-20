import { notFound } from 'next/navigation';
import type { IArticle, INewsletter } from '@lib/models';
import { Article } from '@lib/models';
import { NewsletterHeader } from '@components/NewsletterHeader';
import { ArticleCard } from '@components/ArticleCard';
import { db } from '@lib/prisma/db';
import { MongoFieldFilter, MongoOrExpr, MongoExistsExpr } from '@prisma/orm-mongo/query-ast/execution';

export const dynamic = 'force-dynamic';

async function getNewsletterArticles(id: string) {
  const dbReady = await db()
      .runtime()
      .then(() => true)
      .catch(() => false);
  // Use mock data if DB is not connected
  if (!dbReady) {
    console.warn('Database not connected, using mock newsletter articles');
    return null;
  }

  const newsletter = await db().orm.newsletters.where({ _id: id }).first();
  if (!newsletter) return null;

  const articleIds = newsletter.articles ?? [];

  const articles: IArticle[] = [];
  if (articleIds.length > 0) {
    const idFilter = MongoFieldFilter.in('_id', articleIds.map((aid) => aid));
    const errorFilter = MongoOrExpr.of([
      MongoFieldFilter.eq('lastError', ''),
      new MongoExistsExpr('lastError', false),
    ]);
    for await (const article of Article
      .where(idFilter)
      .where(errorFilter)
      .orderBy({ sourceName: 1, date: -1 })
      .all()) {
      articles.push(article);
    }
  }

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
