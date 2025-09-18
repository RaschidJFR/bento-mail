import { describe, it, expect, vi } from 'vitest';
import { Article } from '@lib/models';
import type { ArticleDetailsProps } from '@lib/ai-article-analyzer';
import { hash } from '@lib/utils.mjs';

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
    it('should not call process() on save', async () => {
      const article = new Article({ url: 'https://example.com', content: 'foo' });
      // Spy on process
      article.process = vi.fn();
      await article.save();
      expect(article.process).not.toHaveBeenCalled();
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
      const utils = await import('@lib/utils.mjs');
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(utils, 'fetchHtmlContent').mockResolvedValue(mockHtml);
      vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue(mockSummaries);

      const article = new Article({ url: 'https://example.com' });
      await article.process();

      expect(utils.fetchHtmlContent).toHaveBeenCalledWith('https://example.com');
      expect(article.content).toBe('Some content');
      expect(article.summaries).toMatchObject({
        oneliner: 'Summary one',
        overview: 'Summary overview',
        details: 'Summary details',
      });
      expect(article.coverImg).toBe('img.jpg');
      expect(article.date).toBe('2023-10-10');
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

      const article = new Article({ content: 'Some content' });
      await article.process();

      expect(analyzer.extractArticleDetails).toHaveBeenCalledWith('Some content');
      expect(article.summaries).toMatchObject({
        oneliner: 'Summary one',
        overview: 'Summary overview',
        details: 'Summary details',
      });
      expect(article.coverImg).toBe('img.jpg');
      expect(article.date).toBe('2023-10-10');
    });

    it('should not re-process if summaries already exist', async () => {
      const analyzer = await import('@lib/ai-article-analyzer');
      const extractArticleDetails = vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue({} as any);

      const article = new Article({
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
  });
});
