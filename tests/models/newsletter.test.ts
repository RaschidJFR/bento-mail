import { describe, it, expect, vi } from 'vitest';
import { Article, Newsletter } from '@lib/models';
import { hash } from '@lib/utils';
import type { BasicArticleProps, NewsletterDataProps } from '@lib/ai-article-analyzer';

describe('Newsletter', () => {
  it('should link existing articles with identical content on creation', async () => {
    // Create and save an article first
    const existingArticle = new Article({ header: 'Existing Article', content: 'Unique Content', sourceName: 'N1' });
    await existingArticle.save();

    // Add a similar article to the newsletter with the same content
    const similarArticle = new Article({ header: 'Similar Article', content: 'Unique Content', sourceName: 'N2' });
    const newsletter = await Newsletter.create({ content: 'Newsletter', articles: [similarArticle] });

    // Compare only the properties
    await newsletter.populate('articles');
    const article = newsletter.articles[0] as Article;
    expect(article._id).toBe(existingArticle._id);
    expect(article.header).toBe('Existing Article'); // header updated from existing article
    expect(article.sourceName).toBe('N1'); // sourceName updated from existing article
    expect(article.isNew).toBe(false);
  });

  describe('_id generation', () => {
    it('should not save two newsletters with the same content', async () => {
      const content = 'Unique Content';
      const newsletter1 = new Newsletter({ content });
      await newsletter1.save();

      const newsletter2 = new Newsletter({ content });
      await expect(newsletter2.save()).rejects.toThrow();
    });

    it('should not save if `content` is not provided', async () => {
      const newsletter = new Newsletter();
      await expect(newsletter.save()).rejects.toThrow(/content/i);
    });

    it('should not have _id without `content`', async () => {
      const newsletter = new Newsletter();
      expect(newsletter._id).toBeFalsy();
    });

    it('should generate _id from `content`', async () => {
      const newsletter = new Newsletter({ content: 'Something' });
      expect(newsletter._id).toBe(hash('Something'));
    });
  });

  describe('extractArticles()', () => {
    it('should not alter content', async () => {
      const mockArticles: BasicArticleProps[] = [
        { header: 'Article 1', content: 'Content 1', sourceName: 'Newsletter Name' },
      ];
      const mockData: NewsletterDataProps = {
        articles: mockArticles,
        name: 'Newsletter Name',
        date: '2023-10-10',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter').mockResolvedValue(mockData);

      const newsletter = await Newsletter.create({
        content: 'Original content',
      });

      await newsletter.extractArticles();

      const updated = await Newsletter.findById(newsletter._id).lean();
      expect(updated?.content).toBe('Original content');
    });

    it('should generate articles from `content`', async () => {
      const mockArticles: BasicArticleProps[] = [
        {
          header: 'Article 1',
          content: 'Content of article 1',
          date: '2000-10-01',
        },
        {
          header: 'Article 2',
          content: 'Content of article 2',
          sourceName: 'Original Source',
        },
      ];

      const mockData: NewsletterDataProps = {
        articles: mockArticles,
        name: 'Newsletter Name',
        date: '2023-10-10',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter').mockResolvedValue(mockData);

      const newsletter = await Newsletter.create({ content: 'The content in the newsletter' });
      await newsletter.extractArticles();
      expect(analyzer.extractArticlesFromNewsletter).toHaveBeenCalledWith('The content in the newsletter');

      const updated = (await Newsletter.findById(newsletter._id).populate('articles')) as Newsletter;
      expect(updated.date).toBe('2023-10-10');
      expect(updated.name).toBe('Newsletter Name');
      expect(updated.articles).toEqual(
        // ignore order and extra properties
        expect.arrayContaining(
          // match a subset of properties
          mockArticles.map((a) => expect.objectContaining(a))
        )
      );
      expect(updated.articles.length).toBe(mockArticles.length);

      // Check that articles have sourceName and date set from newsletter
      expect((updated.articles[0] as Article).sourceName).toBe('Original Source'); // preferred from article
      expect((updated.articles[1] as Article).sourceName).toBe('Newsletter Name'); // defaulted to newsletter
      expect((updated.articles[0] as Article).date).toBe('2000-10-01'); // preferred from article
      expect((updated.articles[1] as Article).date).toBe('2023-10-10'); // defaulted to newsletter
    });

    it('should not re-process nor fail if `articles` is already populated', async () => {
      const mockData = {
        articles: [],
        name: 'Newsletter Name',
        date: '2023-10-10',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      const extractArticlesFromNewsletter = vi
        .spyOn(analyzer, 'extractArticlesFromNewsletter')
        .mockResolvedValue(mockData);

      const newsletter = await Newsletter.create({
        content: 'Some content',
        articles: [await Article.create({ content: 'content 1' }), await Article.create({ content: 'content 2' })],
      });

      await newsletter.extractArticles();
      expect(extractArticlesFromNewsletter).not.toHaveBeenCalled();

      await newsletter.updateOne({ articles: [] });
      await newsletter.extractArticles();
      expect(extractArticlesFromNewsletter).toHaveBeenCalled();
    });

    it('reject if pending changes', async () => {
      const newsletter = new Newsletter({ content: 'Initial content' });
      await newsletter.save();

      // Modify content
      newsletter.content = 'Modified content';
      await expect(newsletter.extractArticles()).rejects.toThrow(/save any changes/i);
    });

    it('update error property accordingly', async () => {
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter')
        .mockRejectedValueOnce(new Error('AI service error'))
        .mockResolvedValue({ articles: [], name: '', date: '' });

      let newsletter = await Newsletter.create({ content: 'Initial content' });

      await expect(newsletter.extractArticles()).rejects.toThrow('AI service error');
      newsletter = (await Newsletter.findById(newsletter._id)) as Newsletter;
      expect(newsletter.error).toBe('AI service error');

      // Delete error and retry
      await newsletter.set({ error: '' }).save();
      await newsletter.extractArticles();
      newsletter = (await Newsletter.findById(newsletter._id)) as Newsletter;
      expect(newsletter.error).toBeFalsy();
    });

    it('skip if previous error exists', async () => {
      const analyzer = await import('@lib/ai-article-analyzer');
      const extractArticlesFromNewsletter = vi.spyOn(analyzer, 'extractArticlesFromNewsletter').mockResolvedValue({
        articles: [],
        name: '',
        date: '',
      });

      const newsletter = await Newsletter.create({
        content: 'Previously Failed Newsletter',
        error: 'Something terrible',
      });
      await newsletter.extractArticles();
      expect(extractArticlesFromNewsletter).not.toHaveBeenCalled();
    });
  });
});
