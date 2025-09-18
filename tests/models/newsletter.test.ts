import { describe, it, expect, vi } from 'vitest';
import { Article, Newsletter } from '@lib/models';
import { hash } from '@lib/utils.mjs';
import type { BasicArticleProps, NewsletterDataProps } from '@lib/ai-article-analyzer';
import type { DocumentType } from '@typegoose/typegoose';
import type { ArticleClass } from '@lib/models/article';

describe('Newsletter', () => {
  it('should save new articles added to `articles` on save', async () => {
    const article1 = new Article({ header: 'A1', content: 'C1', sourceName: 'N1' });
    const article2 = new Article({ header: 'A2', content: 'C2', sourceName: 'N1' });

    const newsletter = new Newsletter({ content: 'Newsletter', articles: [article1, article2] });
    await newsletter.save();

    // Query the database for articles by _id
    const found1 = await Article.findById(article1._id);
    const found2 = await Article.findById(article2._id);

    expect(article1.isNew).toBe(false);
    expect(article2.isNew).toBe(false);
    expect(found1).not.toBeNull();
    expect(found2).not.toBeNull();
    expect(found1?.header).toBe('A1');
    expect(found2?.header).toBe('A2');
  });

  it('should link existing articles with identical content in `articles`', async () => {
    // Create and save an article first
    const existingArticle = new Article({ header: 'Existing Article', content: 'Unique Content', sourceName: 'N1' });
    await existingArticle.save();

    // Add a similar article to the newsletter with the same content
    const similarArticle = new Article({ header: 'Similar Article', content: 'Unique Content', sourceName: 'N2' });
    const newsletter = new Newsletter({ content: 'Newsletter', articles: [similarArticle] });
    await newsletter.save();

    // Compare only the properties
    const article = newsletter.articles[0] as DocumentType<ArticleClass>;
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

  describe('process()', () => {
    it('should not call `Article.process()`', async () => {
      const mockArticles: BasicArticleProps[] = [
        { header: 'Article 1', content: 'Content 1', sourceName: 'Newsletter Name' },
        { header: 'Article 2', content: 'Content 2', sourceName: 'Newsletter Name' },
      ];
      const mockData: NewsletterDataProps = {
        articles: mockArticles,
        name: 'Newsletter Name',
        date: '2023-10-10',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter').mockResolvedValue(mockData);

      // Spy on Article.process
      const articleProcessSpy = vi.spyOn(Article.prototype, 'process');

      const newsletter = new Newsletter({ content: 'Some content' });
      await newsletter.process();

      expect(articleProcessSpy).not.toHaveBeenCalled();
    });

    it('should not call process() on save', async () => {
      const newsletter = new Newsletter({ content: 'The hottest updates of the week:' });
      // Spy on process
      newsletter.process = vi.fn();
      await newsletter.save();
      expect(newsletter.process).not.toHaveBeenCalled();
    });

    it('should generate articles from `content`', async () => {
      const mockArticles: BasicArticleProps[] = [
        {
          header: 'Article 1',
          content: 'Content of article 1',
          sourceName: 'Newsletter Name',
        },
        {
          header: 'Article 2',
          content: 'Content of article 2',
          sourceName: 'Newsletter Name',
        },
      ];

      const mockData: NewsletterDataProps = {
        articles: mockArticles,
        name: 'Newsletter Name',
        date: '2023-10-10',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter').mockResolvedValue(mockData);

      const newsletter = new Newsletter({ content: 'Some content' });
      await newsletter.process();

      expect(analyzer.extractArticlesFromNewsletter).toHaveBeenCalledWith('Some content');
      expect(newsletter.date).toBe('2023-10-10');
      expect(newsletter.name).toBe('Newsletter Name');
      expect(newsletter.articles).toMatchObject(mockArticles);
    });

    it('should not re-process if `articles` is already populated', async () => {
      const mockData = {
        articles: [],
        name: 'Newsletter Name',
        date: '2023-10-10',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      const extractArticlesFromNewsletter = vi
        .spyOn(analyzer, 'extractArticlesFromNewsletter')
        .mockResolvedValue(mockData);

      const newsletter = new Newsletter({
        content: 'Some content',
        articles: [new Article(), new Article()],
      });

      await newsletter.process();
      expect(extractArticlesFromNewsletter).not.toHaveBeenCalled();

      newsletter.articles = [];
      await newsletter.process();
      expect(extractArticlesFromNewsletter).toHaveBeenCalled();
    });
  });
});
