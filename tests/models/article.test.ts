import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Article, IArticle } from '@lib/models/article';
import { hash } from '@lib/utils';

function makeInput(data: {
  content?: string;
  url?: string;
  summaries?: IArticle['summaries'] | null;
}): Omit<IArticle, '_id'> {
  return {
    header: '',
    sourceName: '',
    content: data.content || null,
    url: data.url || null,
    date: null,
    coverImg: null,
    summaries: data.summaries || null,
    linkedArticles: null,
    lastError: null,
    ...data,
  };
}

describe('Article', () => {
  describe('generateId()', () => {
    it('should reject creating two articles with the same content', async () => {
      await Article.create(makeInput({ content: 'Unique Content' }));
      await expect(Article.create(makeInput({ content: 'Unique Content' }))).rejects.toThrow();
    });

    it('should throw if neither `url` nor `content` is provided', () => {
      expect(() => Article.generateId({} as any)).toThrow(/url|content/i);
    });

    it('should generate _id from `url` if provided', () => {
      expect(Article.generateId({ url: 'https://example.com' } as any)).toBe(hash('https://example.com'));
    });

    it('should generate _id from `content` if `url` is not provided', () => {
      expect(Article.generateId({ content: 'Something' } as any)).toBe(hash('Something'));
    });

    it('should generate _id from `url` over `content`', () => {
      expect(Article.generateId({ content: 'Something', url: 'https://example.com' } as any)).toBe(
        hash('https://example.com'),
      );
    });
  });

  describe('process()', () => {
    beforeEach(async () => {
      // Mock ai-article-analyzer
      vi.restoreAllMocks();
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue({
        summaries: {
          oneliner: 'Mocked oneliner',
          overview: 'Mocked overview',
          details: 'Mocked details',
        },
        coverImg: 'mocked-image.jpg',
        date: '2023-01-01',
        sourceName: '',
        linkedArticles: [],
      });
    });

    it('should generate summaries from url if provided', async () => {
      const mockHtml = '<p>Some content</p>';

      // Mock fetchHtmlContent and htmlToMarkdown
      const utils = await import('@lib/utils');
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(utils, 'fetchHtmlContent').mockResolvedValue(mockHtml);
      vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue({
        summaries: {
          oneliner: 'Summary one',
          overview: 'Summary overview',
          details: 'Summary details',
        },
        coverImg: 'img.jpg',
        date: '2023-10-10',
        sourceName: '',
        linkedArticles: [],
      });

      const article = await Article.create(makeInput({ url: 'https://example.com' }));
      await Article.process(article._id);
      const updated = await Article.where({ _id: article._id }).first();

      expect(utils.fetchHtmlContent).toHaveBeenCalledWith('https://example.com');
      expect(updated?.content).toBe('Some content');
      expect(updated?.summaries).toMatchObject({
        oneliner: 'Summary one',
        overview: 'Summary overview',
        details: 'Summary details',
      });
      expect(updated?.coverImg).toBe('img.jpg');
      expect(updated?.date).toBe('2023-10-10');
    });

    it('should generate summaries from `content` if `url` is falsy', async () => {
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue({
        summaries: {
          oneliner: 'Summary one',
          overview: 'Summary overview',
          details: 'Summary details',
        },
        coverImg: 'img.jpg',
        date: '2023-10-10',
        sourceName: '',
        linkedArticles: [],
      });

      const article = await Article.create(makeInput({ content: 'Some content' }));
      await Article.process(article._id);
      const updated = await Article.where({ _id: article._id }).first();

      expect(analyzer.extractArticleDetails).toHaveBeenCalledWith('Some content');
      expect(updated?.summaries).toMatchObject({
        oneliner: 'Summary one',
        overview: 'Summary overview',
        details: 'Summary details',
      });
      expect(updated?.coverImg).toBe('img.jpg');
      expect(updated?.date).toBe('2023-10-10');
    });

    it('should not re-process nor fail if summaries already exist', async () => {
      const analyzer = await import('@lib/ai-article-analyzer');
      const extractArticleDetails = vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue({} as any);

      const article = await Article.create(
        makeInput({
          content: 'Some content',
          summaries: {
            oneliner: 'Already summarized',
            overview: 'Already summarized',
            details: 'Already summarized',
          },
        }),
      );

      await Article.process(article._id);
      expect(extractArticleDetails).not.toHaveBeenCalled();
    });

    it('throws if the article does not exist', async () => {
      await expect(Article.process('nonexistent-id')).rejects.toThrow(/not found/i);
    });

    it('save error message if processing fails, clear if succeeds', async () => {
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'extractArticleDetails').mockRejectedValueOnce(new Error('Fail reason here!'));

      const input = makeInput({ content: 'Article with errors' });
      const article = await Article.create(input);

      await expect(Article.process(article._id)).rejects.toThrow('Fail reason here');
      let current = await Article.where({ _id: article._id }).first();
      expect(current?.lastError).toMatch('Fail reason here');

      await Article.process(article._id);
      current = await Article.where({ _id: article._id }).first();
      expect(current?.lastError).toBeFalsy();
    });

    it('generate cover image if missing', async () => {});
  });
});
