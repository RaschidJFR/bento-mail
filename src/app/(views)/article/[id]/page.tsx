import { notFound } from 'next/navigation';
import { Article } from '@lib/models';
import type { IArticle } from '@lib/models';
import { ArticleCard } from '@components/ArticleCard';

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

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) return notFound();

  return (
    <div className="space-y-6">
      <ArticleCard article={article} />
    </div>
  );
}
