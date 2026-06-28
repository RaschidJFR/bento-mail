import { describe, it, expect, vi } from 'vitest';
import { Article } from '@lib/models/article';
import { INewsletter, Newsletter } from '@lib/models/newsletter';
import { hash } from '@lib/utils';

function articleInput(data: { content: string; header?: string; sourceName?: string }) {
  return {
    content: data.content,
    header: data.header ?? '',
    sourceName: data.sourceName ?? '',
    url: null,
    date: null,
    coverImg: null,
    summaries: null,
    linkedArticles: null,
    lastError: null,
  };
}

function newsletterInput(data: Partial<INewsletter> & { content: string }) {
  return {
    content: data.content,
    articles: data.articles ?? [],
    date: data.date ?? null,
    name: data.name ?? null,
    url: data.url ?? null,
    error: data.error ?? null,
  };
}

async function fetchNewsletter(id: string) {
  return Newsletter.where({ _id: id }).first();
}

async function fetchArticlesOf(newsletterId: string) {
  const nl = await Newsletter.where({ _id: newsletterId }).first();
  if (!nl) return [];
  return Promise.all(nl.articles.map((aid) => Article.where({ _id: aid }).first()));
}

describe('Newsletter', () => {
  describe('create()', () => {
    it('links to existing articles by _id', async () => {
      const existing = await Article.create(
        articleInput({ content: 'Unique Content', header: 'Existing Article', sourceName: 'N1' }),
      );

      const newsletter = await Newsletter.create(
        newsletterInput({ content: 'Newsletter', articles: [existing._id] }),
      );

      expect(newsletter.articles).toEqual([existing._id]);
    });

    it('rejects when a referenced article does not exist', async () => {
      await expect(
        Newsletter.create(newsletterInput({ content: 'Newsletter', articles: ['nonexistent-id'] })),
      ).rejects.toThrow(/must be saved/i);
    });
  });

  describe('_id generation', () => {
    it('rejects creating two newsletters with the same content', async () => {
      const content = 'Unique Content';
      await Newsletter.create(newsletterInput({ content }));
      await expect(Newsletter.create(newsletterInput({ content }))).rejects.toThrow();
    });

    it('rejects when `content` is not provided', async () => {
      await expect(Newsletter.create({ articles: [] } as any)).rejects.toThrow(/content/i);
    });

    it('Newsletter.generateId throws without `content`', () => {
      expect(() => Newsletter.generateId({} as any)).toThrow(/content/i);
    });

    it('generates _id from `content`', () => {
      expect(Newsletter.generateId({ content: 'Something' })).toBe(hash('Something'));
    });
  });

  describe('extractArticles()', () => {
    it('does not alter content', async () => {
      const mockArticles = [
        { header: 'Article 1', content: 'Content 1', sourceName: 'Newsletter Name', url: '', coverImg: '' },
      ];
      const mockData = { articles: mockArticles, name: 'Newsletter Name' };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter').mockResolvedValue(mockData);

      const created = await Newsletter.create(newsletterInput({ content: 'Original content' }));
      await Newsletter.extractArticles(created._id);

      const updated = await fetchNewsletter(created._id);
      expect(updated?.content).toBe('Original content');
    });

    it('generates articles from `content` (multi-article newsletter)', async () => {
      const mockArticles = [
        {
          header: 'Article 1',
          content: 'Content of article 1',
          sourceName: '', // To be defaulted to newsletter name
          url: '',
          coverImg: '',
          date: '2000-10-01',
        },
        {
          header: 'Article 2',
          content: 'Content of article 2',
          sourceName: 'Original Source',
          url: '',
          coverImg: '',
          date: '', // To be defaulted to newsletter date
        },
      ];

      const mockData = {
        articles: mockArticles,
        name: 'Newsletter Name',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter').mockResolvedValue(mockData);

      const created = await Newsletter.create(newsletterInput({ content: 'The content in the newsletter' }));

      await Newsletter.extractArticles(created._id);
      expect(analyzer.extractArticlesFromNewsletter).toHaveBeenCalledWith('The content in the newsletter');

      const updated = await fetchNewsletter(created._id);
      expect(updated?.date).toBe('2023-10-10');
      expect(updated?.name).toBe('Newsletter Name');

      const articles = await fetchArticlesOf(created._id);
      const article1 = articles.find((a) => a?.header === 'Article 1')!;
      const article2 = articles.find((a) => a?.header === 'Article 2')!;
      expect(article1.sourceName).toBe('Newsletter Name'); // defaulted to newsletter's
      expect(article1.date).toBe('2000-10-01'); // preferred from article
      expect(article2.sourceName).toBe('Original Source'); // preferred from article
      expect(article2.date).toBe('2023-10-10'); // defaulted to newsletter's
    });

    it('generates article from `content` (single-article)', async () => {
      const mockArticle = {
        coverImg: '',
        sourceName: 'Single Article Source',
        date: '2025-10-20',
        summaries: {
          oneliner: 'Single Article Title',
          overview: 'Overview summary',
          details: 'Supporting details',
        },
        content: 'watever',
        url: 'https://example.com/some-article',
        linkedArticles: [],
      };
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'article', reason: '' });
      vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue(mockArticle);

      const created = await Newsletter.create(newsletterInput({ content: 'Single article content' }));
      await Newsletter.extractArticles(created._id);
      expect(analyzer.extractArticleDetails).toHaveBeenCalledWith('Single article content', { skipVerify: true });

      const updated = await fetchNewsletter(created._id);
      expect(updated?.articles.length).toBe(1);
      const article = await Article.where({ _id: updated!.articles[0] }).first();
      expect(article).toMatchObject(mockArticle);
      expect(article?.header).toBe('Single Article Title');

      // Newsletter properties updated from article
      expect(updated?.name).toBe('Single Article Source');
      expect(updated?.date).toBe('2025-10-20');
    });

    it('can re-process single-article newsletter', async () => {
      const mockArticleData = {
        coverImg: '',
        sourceName: 'Single Article Source',
        date: '2025-10-20',
        summaries: {
          oneliner: 'Single Article Title',
          overview: 'Overview summary',
          details: 'Supporting details',
        },
        content: 'watever',
        url: 'https://example.com/some-article',
        linkedArticles: [],
      };
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'article', reason: '' });
      vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue(mockArticleData);

      const created = await Newsletter.create(newsletterInput({ content: 'Single-article newsletter content' }));
      await Newsletter.extractArticles(created._id);
      await expect(Newsletter.extractArticles(created._id, { force: true })).resolves.toBe(0);
      expect(analyzer.extractArticleDetails).toHaveBeenCalledTimes(2);
    });

    it('can re-process multi-article newsletter', async () => {
      const articles = [
        {
          header: 'Article 1',
          content: 'Content of article 1',
          sourceName: '', // To be defaulted to newsletter name
          url: '',
          coverImg: '',
          date: '2000-10-01',
        },
        {
          header: 'Article 2',
          content: 'Content of article 2',
          sourceName: 'Original Source',
          url: '',
          coverImg: '',
          date: '', // To be defaulted to newsletter date
        },
      ];

      const mockNewsletterData = {
        articles: articles,
        name: 'Newsletter Name',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter').mockResolvedValue(mockNewsletterData);

      const created = await Newsletter.create(newsletterInput({ content: 'The content in the newsletter' }));
      await Newsletter.extractArticles(created._id);
      let updated = await fetchNewsletter(created._id);
      expect(updated?.articles.length).toBe(2);

      await expect(Newsletter.extractArticles(created._id, { force: true })).resolves.toBe(0);
      updated = await fetchNewsletter(created._id);
      expect(analyzer.extractArticlesFromNewsletter).toHaveBeenCalledTimes(2);
      expect(updated?.articles.length).toBe(2);
    });

    it('does not re-process if `articles` is already populated', async () => {
      const mockData = { articles: [], name: 'Newsletter Name' };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
      const extractArticlesFromNewsletter = vi
        .spyOn(analyzer, 'extractArticlesFromNewsletter')
        .mockResolvedValue(mockData);

      const a1 = await Article.create(articleInput({ content: 'content 1', header: 'A1' }));
      const a2 = await Article.create(articleInput({ content: 'content 2', header: 'A2' }));

      const created = await Newsletter.create(
        newsletterInput({ content: 'Some content', articles: [a1._id, a2._id] }),
      );

      await Newsletter.extractArticles(created._id);
      expect(extractArticlesFromNewsletter).not.toHaveBeenCalled();

      // Clear articles and try again
      await Newsletter.where({ _id: created._id }).update({ articles: [] });
      await Newsletter.extractArticles(created._id);
      expect(extractArticlesFromNewsletter).toHaveBeenCalled();
    });

    it('throws if the newsletter does not exist', async () => {
      await expect(Newsletter.extractArticles('nonexistent-id')).rejects.toThrow(/not found/i);
    });

    it('updates error property accordingly', async () => {
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter')
        .mockRejectedValueOnce(new Error('AI service error'))
        .mockResolvedValue({ articles: [], name: '' });

      const created = await Newsletter.create(newsletterInput({ content: 'Initial content' }));

      await expect(Newsletter.extractArticles(created._id)).rejects.toThrow('AI service error');
      let row = await fetchNewsletter(created._id);
      expect(row?.error).toBe('AI service error');

      // Clear error and retry
      await Newsletter.where({ _id: created._id }).update({ error: '' });
      await Newsletter.extractArticles(created._id);
      row = await fetchNewsletter(created._id);
      expect(row?.error).toBeFalsy();
    });

    it('skips if previous error exists', async () => {
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
      const extractArticlesFromNewsletter = vi
        .spyOn(analyzer, 'extractArticlesFromNewsletter')
        .mockResolvedValue({ articles: [], name: '' });

      const created = await Newsletter.create(
        newsletterInput({ content: 'Previously Failed Newsletter', error: 'Something terrible' }),
      );
      await Newsletter.extractArticles(created._id);
      expect(extractArticlesFromNewsletter).not.toHaveBeenCalled();
    });
  });
});
