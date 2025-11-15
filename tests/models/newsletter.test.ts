import { describe, it, expect, vi } from 'vitest';
import { Article, Newsletter } from '@lib/models';
import { hash } from '@lib/utils';
import type { BasicArticleProps, NewsletterDataProps, ArticleDetailsProps } from '@lib/ai-article-analyzer';

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
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter').mockResolvedValue(mockData);

      const newsletter = await Newsletter.create({
        content: 'Original content',
      });

      await newsletter.extractArticles();

      const updated = await Newsletter.findById(newsletter._id).lean();
      expect(updated?.content).toBe('Original content');
    });

    it('should generate articles from `content` (multi-article newsletter)', async () => {
      const mockArticles: BasicArticleProps[] = [
        {
          header: 'Article 1',
          content: 'Content of article 1',
          sourceName: '', // To be defaulted to newsletter name
          date: '2000-10-01',
        },
        {
          header: 'Article 2',
          content: 'Content of article 2',
          sourceName: 'Original Source',
          date: '', // To be defaulted to newsletter date
        },
      ];

      const mockData: NewsletterDataProps = {
        articles: mockArticles,
        name: 'Newsletter Name',
        date: '2023-10-10',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter').mockResolvedValue(mockData);

      const newsletter = await Newsletter.create({ content: 'The content in the newsletter' });

      await newsletter.extractArticles();
      expect(analyzer.extractArticlesFromNewsletter).toHaveBeenCalledWith('The content in the newsletter');

      const updated = (await Newsletter.findById(newsletter._id).populate('articles')) as Newsletter;
      expect(updated.date).toBe('2023-10-10');
      expect(updated.name).toBe('Newsletter Name');

      // Check that articles have sourceName and date set correctly
      const article1 = updated.articles.find((a) => (a as Article).header === 'Article 1') as Article;
      const article2 = updated.articles.find((a) => (a as Article).header === 'Article 2') as Article;
      expect(article1.sourceName).toBe('Newsletter Name'); // defaulted to newsletter's
      expect(article1.date).toBe('2000-10-01'); // preferred from article
      expect(article2.sourceName).toBe('Original Source'); // preferred from article
      expect(article2.date).toBe('2023-10-10'); // defaulted to newsletter's
    });

    it('should generate article from `content` (single-article)', async () => {
      const mockArticle = {
        coverImg: '',
        sourceName: 'Single Article Source',
        date: '2025-10-20',
        summaries: {
          oneliner: 'Single Article Title',
          overview: 'Overview summary',
          details: 'Supporting details',
        },
      } as ArticleDetailsProps;
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'article', reason: '' });
      vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue(mockArticle);

      const newsletter = await Newsletter.create({ content: 'Single article content' });
      await newsletter.extractArticles();
      expect(analyzer.extractArticleDetails).toHaveBeenCalledWith('Single article content', { skipVerify: true });

      const updated = (await Newsletter.findById(newsletter._id).populate('articles')) as Newsletter;
      expect(updated.articles.length).toBe(1);
      const article = updated.articles[0] as Article;
      expect(article).toMatchObject(mockArticle);
      expect(article.header).toBe('Single Article Title');

      // Newsletter properties updated from article
      expect(updated.name).toBe('Single Article Source');
      expect(updated.date).toBe('2025-10-20');
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
      } as ArticleDetailsProps;
      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'article', reason: '' });
      vi.spyOn(analyzer, 'extractArticleDetails').mockResolvedValue(mockArticleData);

      const newsletter = await Newsletter.create({ content: 'Single-article newsletter content' });
      await newsletter.extractArticles();
      await expect(newsletter.extractArticles({ force: true })).resolves.toBe(0);
      expect(analyzer.extractArticleDetails).toHaveBeenCalledTimes(2);
    });

    it('can re-process multi-article newsletter', async () => {
      const articles: BasicArticleProps[] = [
        {
          header: 'Article 1',
          content: 'Content of article 1',
          sourceName: '', // To be defaulted to newsletter name
          date: '2000-10-01',
        },
        {
          header: 'Article 2',
          content: 'Content of article 2',
          sourceName: 'Original Source',
          date: '', // To be defaulted to newsletter date
        },
      ];

      const mockNewsletterData: NewsletterDataProps = {
        articles,
        name: 'Newsletter Name',
        date: '2023-10-10',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter').mockResolvedValue(mockNewsletterData);

      const newsletter = await Newsletter.create({ content: 'The content in the newsletter' });
      await newsletter.extractArticles();
      expect(newsletter.articles.length).toBe(2);
      await expect(newsletter.extractArticles({ force: true })).resolves.toBe(0);
      expect(analyzer.extractArticlesFromNewsletter).toHaveBeenCalledTimes(2);
      expect(newsletter.articles.length).toBe(2);
    });

    it('should not re-process nor fail if `articles` is already populated', async () => {
      const mockData = {
        articles: [],
        name: 'Newsletter Name',
        date: '2023-10-10',
      };

      const analyzer = await import('@lib/ai-article-analyzer');
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
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
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
      vi.spyOn(analyzer, 'extractArticlesFromNewsletter')
        .mockRejectedValueOnce(new Error('AI service error'))
        .mockResolvedValue({ articles: [], name: '', date: '' });

      let newsletter = (await Newsletter.create({ content: 'Initial content' })) as Newsletter;

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
      vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });
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
