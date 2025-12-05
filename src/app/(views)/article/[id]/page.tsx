import { notFound } from 'next/navigation';
import { Article } from '@lib/models';
import type { IArticle } from '@lib/models';
import { ArticleCard } from '@components/ArticleCard';
import type { Metadata, ResolvingMetadata } from 'next';

export const dynamic = 'force-dynamic';

const mockArticle: IArticle = {
  _id: 'mock-id-123',
  header: '(Mock Article) How AI is Transforming Modern Newsletters',
  content: `Artificial Intelligence is rapidly changing the way newsletters are curated and delivered. 
Publishers now use AI to summarize articles, personalize content, and optimize delivery times for maximum engagement.`,
  url: 'https://example.com/ai-newsletters',
  date: '2024-06-01',
  coverImg: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
  sourceName: 'Tech News Daily',
  summaries: {
    oneliner: 'AI revolutionizes newsletter curation and personalization.',
    overview: 'AI enables smarter, more engaging newsletters by automating curation and tailoring content to readers.',
    details:
      'With AI, publishers can analyze reader preferences, summarize lengthy articles, and deliver content at optimal times. This leads to higher engagement and more relevant information for subscribers, transforming the traditional newsletter experience.',
  },
  lastError: '',
};

async function getArticle(id: string) {
  if (Article.db.readyState != 1) {
    console.warn('Database not connected, using mock article');
    return mockArticle;
  }
  const article = await Article.findById(id).lean();
  if (!article) return null;
  return article as IArticle;
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) {
    return {
      title: 'Article Not Found',
      description: 'The requested article could not be found.',
    };
  }

  const { oneliner = '', overview = '' } = article.summaries || {};
  const description = overview || '';
  const title = article.header || oneliner;

  return {
    title: `${title || oneliner || 'Article summary'} | Bento Mail`,
    description,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: title || oneliner || 'See this article summary',
      description,
      url: process.env.APP_URL ? `${process.env.APP_URL}/article/${article._id}` : undefined,
      siteName: 'Bento Mail',
      images: article.coverImg
        ? [
            {
              url: article.coverImg,
              width: 862, // The current ArticleCard cover image size
              height: 485,
              alt: oneliner,
            },
          ]
        : undefined,
      locale: 'en_US',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: oneliner,
      description: overview || '',
      images: article.coverImg ? [article.coverImg] : undefined,
    },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) return notFound();

  return (
    <main>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <section>
            <ArticleCard article={article} showToolbar={false} />
          </section>
          <section>
            <div className="text-center mt-10 text-muted-foreground">
              <p>Drowning in newsletters?</p>
              <p>Forward them to us and get info bites like this.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
