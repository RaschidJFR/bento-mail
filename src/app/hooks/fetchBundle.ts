'use server';
import { Bundle, IArticle, INewsletter } from '@lib/models';
import type { ReactionsEnum } from '@lib/models/enums';
import { JobNames, Task, ITask } from '@services/worker';
import { db } from '@lib/prisma/db';

// TODO: this should be moved out of lib as it is not frontend compatible.

type NewsletterWithArticles = Omit<INewsletter, 'articles'> & {
  articles: IArticle[];
};

export interface BundleData {
  userId: string;
  reactionMap?: Map<string, ReactionsEnum>;
  tasks: ITask[];
  articles: IArticle[];
  newsletters: NewsletterWithArticles[];
}

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
    linkedArticles: [],
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
    linkedArticles: [],
  },
];

export async function fetchBundleData(id: string, debug = false): Promise<BundleData | null> {
  const dbReady = await db()
    .runtime()
    .then(() => true)
    .catch(() => false);

  // Use mock data if DB is not connected
  if (!dbReady) {
    console.warn('Database not connected, using mock bundle articles');
    return {
      userId: '',
      reactionMap: new Map<string, ReactionsEnum>(),
      tasks: [],
      articles: [],
      newsletters: [
        {
          _id: 'mock-newsletter-1',
          name: 'Mock Newsletter',
          date: '2024-06-01',
          articles: mockArticles,
          error: '',
          content: '',
          url: '',
        } as NewsletterWithArticles,
      ],
    };
  }

  /** @deprecated */
  const reactionMap = new Map<string, ReactionsEnum>();

  const bundleData = await Bundle.getUnreadArticles(id);

  if (!bundleData) return null;

  const articleIds = bundleData.allArticleIds || [];

  // Fetch processing jobs for articles in this bundle
  const activeTasks: ITask[] = await Task.findActiveArticleProcessTasks(
    articleIds,
    JobNames.Article.process,
  );

  const newsletters = bundleData.newsletters || [];
  const articles = bundleData.articles || [];
  const tasks = activeTasks.map((t) => ({ ...t, _id: String(t._id) }));

  return {
    newsletters,
    articles,
    userId: String(bundleData.user) || '',
    reactionMap,
    tasks,
  };
}
