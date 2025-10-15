import { notFound } from 'next/navigation';
import { NewsletterDisplay } from '@components/NewsletterDisplay';
import { ArticleCard } from '@app/components/ArticleCard';
import { fetchBundleData } from '@app/hooks/fetchBundle';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const debug = (await searchParams)?.debug;
  const data = await fetchBundleData(id, debug == '1');
  if (!data) return notFound();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <main>
          <div className="space-y-12 mb-6">
            {!!data.articles.length &&
              data.articles.map((article) => (
                <ArticleCard
                  key={article._id}
                  article={article}
                  userId={data.userId}
                  reaction={data.reactionMap?.get(article._id)}
                  jobId={data.jobMap.get(article._id)}
                />
              ))}
          </div>
          <div className="space-y-12">
            {data.newsletters.length ? (
              data.newsletters.map(
                (newsletter) =>
                  !!newsletter.articles?.length && (
                    <NewsletterDisplay
                      key={newsletter._id}
                      newsletter={newsletter}
                      userId={data.userId}
                      reactionMap={data.reactionMap}
                      jobMap={data.jobMap}
                    />
                  )
              )
            ) : (
              <p className="text-center text-muted-foreground">No newsletters available.</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
