import { notFound } from 'next/navigation';
import { Bundle, IArticle, IBundle, INewsletter } from '@lib/models';
import { NewsletterDisplay } from '@components/NewsletterDisplay';
import type { ReactionsEnum } from '@lib/models/enums';
import { ArticleCard } from '@app/components/ArticleCard';
import { NewsletterHeader } from '@app/components/NewsletterHeader';

export const dynamic = 'force-dynamic';

// Mock articles strictly following IArticle interface from /lib/models/article.ts
const mockArticles: IArticle[] = [
  {
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
      overview:
        'AI enables smarter, more engaging newsletters by automating curation and tailoring content to readers.',
      details:
        'With AI, publishers can analyze reader preferences, summarize lengthy articles, and deliver content at optimal times. This leads to higher engagement and more relevant information for subscribers, transforming the traditional newsletter experience.',
    },
    lastError: '',
  },
  {
    _id: 'mock-id-456',
    header: '(Mock Article) The Future of Email Subscriptions',
    content: `Email subscriptions are evolving with the help of technology. 
AI and automation are making it easier for readers to get the content they care about.`,
    url: 'https://example.com/future-email',
    date: '2024-06-02',
    coverImg: 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=80',
    sourceName: 'Inbox Weekly',
    summaries: {
      oneliner: 'Email subscriptions get smarter with AI.',
      overview: 'Automation and AI are shaping the next generation of email newsletters.',
      details:
        'From personalized recommendations to automated content curation, the future of email subscriptions is bright. Readers can expect more relevant and timely content delivered straight to their inbox.',
    },
    lastError: '',
  },
];

async function getBundleArticles(id: string) {
  // Use mock data if DB is not connected
  if (Bundle.db.readyState != 1) {
    console.warn('Database not connected, using mock bundle articles');
    return {
      count: mockArticles.length,
      userId: '',
      reactionMap: new Map<string, ReactionsEnum>(),
      articles: [],
      newsletters: [
        {
          _id: 'mock-newsletter-1',
          name: 'Mock Newsletter',
          date: '2024-06-01',
          articles: mockArticles,
          error: '',
          content: '',
        } as INewsletter,
      ],
    };
  }

  const reactionMap = await Bundle.getReactionMap(id);
  const articlesWithReactions = Array.from(reactionMap.keys());

  const bundle: IBundle | null = await Bundle.findById(id)
    .populate([
      {
        path: 'articles',
        match: {
          $or: [{ lastError: '' }, { lastError: { $exists: false } }],
          _id: { $nin: articlesWithReactions },
        },
      },
      {
        path: 'newsletters',
        match: {
          $or: [{ lastError: '' }, { lastError: { $exists: false } }],
        },
        populate: {
          path: 'articles',
          match: {
            $or: [{ lastError: '' }, { lastError: { $exists: false } }],
            _id: { $nin: articlesWithReactions },
          },
        },
      },
    ])
    .sort({ sourceName: 1, date: -1 })
    .lean();

  if (!bundle) return null;

  return {
    newsletters: (bundle.newsletters || []) as INewsletter[],
    articles: (bundle.articles || []) as IArticle[],
    userId: String(bundle.user._id) || '',
    reactionMap,
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getBundleArticles(id);
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
