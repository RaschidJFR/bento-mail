import { Bundle, IArticle, IBundle, INewsletter } from '@lib/models';
import type { ReactionsEnum } from '@lib/models/enums';
import { JobNames, Task, ITask } from '@services/worker';

// TODO: this should be moved out of lib as it is not frontend compatible.

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

export async function fetchBundleData(id: string, debug = false) {
  // Use mock data if DB is not connected
  if (Bundle.db.readyState != 1) {
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
        } as INewsletter,
      ],
    };
  }

  // Match filters
  const excludeWithErrors = debug ? {} : { $or: [{ lastError: '' }, { lastError: { $exists: false } }] };
  let excludeWithReactions = {};
  let reactionMap = new Map<string, ReactionsEnum>();

  if (debug) {
    // Only for debug mode, fetch reactions to show in the UI since it's an expensive query.
    reactionMap = await Bundle.getReactionMap(id);
    const articlesWithReactions = Array.from(reactionMap.keys());
    excludeWithReactions = { _id: { $nin: articlesWithReactions } };
  } else {
    const articlesWithoutReactions = await Bundle.getArticlesWithoutReactions(id);
    excludeWithReactions = { _id: { $in: articlesWithoutReactions } };
  }

  console.debug(`excludeWithReactions filter: ${JSON.stringify(excludeWithReactions)}`);
  const bundleData: IBundle | null = await Bundle.findById(id)
    .populate([
      {
        path: 'articles',
        match: {
          ...excludeWithErrors,
          ...excludeWithReactions,
        },
      },
      {
        path: 'newsletters',
        match: {
          ...excludeWithErrors,
        },
        options: { sort: { date: -1 } },
        populate: {
          path: 'articles',
          match: {
            ...excludeWithErrors,
            ...excludeWithReactions,
          },
        },
      },
    ])
    .sort({ sourceName: 1, date: -1 })
    .lean();

  if (!bundleData) return null;

  const articleIds = Bundle.unwrapArticleIds(bundleData);

  // Fetch processing jobs for articles in this bundle
  const activeTasks: ITask<{ id: string }>[] = await Task.find<ITask>({
    name: JobNames.Article.process,
    'data.id': { $in: articleIds },
    $or: [{ lockedAt: { $exists: true, $ne: null } }, { nextRunAt: { $exists: true, $ne: null } }],
  }).lean();

  const newsletters = (bundleData.newsletters || []) as INewsletter[];
  const articles = (bundleData.articles || []) as IArticle[];
  const tasks = activeTasks.map((t) => ({ ...t, _id: String(t._id) }));

  return {
    newsletters,
    articles,
    userId: String(bundleData.user._id) || '',
    reactionMap,
    tasks,
  };
}
