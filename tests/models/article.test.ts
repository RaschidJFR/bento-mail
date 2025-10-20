import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Article } from '@lib/models';
import type { ArticleDetailsProps } from '@lib/ai-article-analyzer';
import { hash } from '@lib/utils';

describe('Article', () => {
  describe('_id generation', () => {
    it('should not save two articles with the same content', async () => {
      const article1 = new Article({ content: 'Unique Content' });
      await article1.save();

      const article2 = new Article({ content: 'Unique Content' });
      await expect(article2.save()).rejects.toThrow();
    });

    it('should not save if neither `url` nor `content` is provided', async () => {
      const article = new Article();
      await expect(article.save()).rejects.toThrow(/url|content/i);
    });

    it('should not have _id without `url` or `content`', async () => {
      const article = new Article();
      expect(article._id).toBeFalsy();
    });

    it('should generate _id from `url` if provided', async () => {
      const article = new Article({ url: 'https://example.com' });
      expect(article._id).toBe(hash('https://example.com'));
    });

    it('should generate _id from `content` if `url` is not provided', async () => {
      const article = new Article({ content: 'Something' });
      expect(article._id).toBe(hash('Something'));
    });

    it('should generate _id from `url` over `content`', async () => {
      const article = new Article({ content: 'Something', url: 'https://example.com' });
      expect(article._id).toBe(hash('https://example.com'));
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
      });
    });

    it('should generate summaries from url if provided', async () => {
      const mockHtml = '<p>Some content</p>';
      const mockSummaries: ArticleDetailsProps = {
        summaries: {
          oneliner: 'Summary one',
          overview: 'Summary overview',
          details: 'Summary details',
        },
        coverImg: 'img.jpg',
        date: '2023-10-10',
      };

      // Mock fetchHtmlContent and htmlToMarkdown
      const utils = await import('@lib/utils');
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(utils, 'fetchHtmlContent').mockResolvedValue(mockHtml);
      vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue(mockSummaries);

      const article = await Article.create({ url: 'https://example.com' });
      await article.process();
      const updated = await Article.findById(article._id).lean();

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
      const mockSummaries: ArticleDetailsProps = {
        summaries: {
          oneliner: 'Summary one',
          overview: 'Summary overview',
          details: 'Summary details',
        },
        coverImg: 'img.jpg',
        date: '2023-10-10',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue(mockSummaries);

      const article = await Article.create({ content: 'Some content' });
      await article.process();
      const updated = await Article.findById(article._id).lean();

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

      const article = await Article.create({
        content: 'Some content',
        summaries: {
          oneliner: 'Already summarized',
          overview: 'Already summarized',
          details: 'Already summarized',
        },
      });

      await article.process();
      expect(extractArticleDetails).not.toHaveBeenCalled();
    });

    it('reject if pending changes', async () => {
      const article = new Article({ content: 'Initial content' });
      await article.save();

      // Modify content
      article.content = 'Modified content';
      await expect(article.process()).rejects.toThrow(/save any changes/i);

      // Save. Now should work
      await article.save();
      await expect(article.process()).resolves.not.toThrow();
    });

    it('save error message if processing fails, clear if succeeds', async () => {
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'extractArticleDetails').mockRejectedValueOnce(new Error('Fail reason here!'));

      let article = new Article({ content: 'Article with errors' });
      await article.save();

      await expect(article.process()).rejects.toThrow('Fail reason here');
      article = (await Article.findById(article._id)) as Article;
      expect(article?.lastError).toMatch('Fail reason here');

      await article.process();
      article = (await Article.findById(article._id)) as Article;
      expect(article?.lastError).toBeFalsy();
    });

    it('generate cover image if missing', async () => {});
  });
});
