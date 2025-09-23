import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User, Newsletter, Article } from '@lib/models';
import { Bundle } from '@lib/models/bundle';
import { afterEach } from 'node:test';

describe('Bundle', () => {
  it('should not save without an existing user', async () => {
    const bundle = new Bundle();
    await expect(bundle.save()).rejects.toThrow();

    const unsavedUser = new User({ email: 'someone@somewhere.ca' });
    bundle.user = unsavedUser;
    await expect(bundle.save()).rejects.toThrow();

    await unsavedUser.save();
    await expect(bundle.save()).resolves.toBeTruthy();
  });

  describe('AddElements', () => {
    it('addNewsletter add single and multiple newsletter ids, prevents duplicates', async () => {
      const bundle = new Bundle({ user: '507f1f77bcf86cd799439011' });
      // Single add
      bundle.addNewsletter('nid1');
      expect(bundle.newsletters).toContain('nid1');
      // Duplicate add
      bundle.addNewsletter('nid1');
      expect(bundle.newsletters).toEqual(['nid1']);
      // Multiple add
      bundle.addNewsletter(['nid2', 'nid3', 'nid1', 'nid3', 'nid3']);
      expect(bundle.newsletters).toEqual(['nid1', 'nid2', 'nid3']);
    });

    it('addNewsletter adds Newsletter objects, prevents duplicates', async () => {
      const bundle = new Bundle({ user: '507f1f77bcf86cd799439011' });
      const newsletter1 = new Newsletter({ content: 'Newsletter 1' });
      const newsletter2 = new Newsletter({ content: 'Newsletter 2' });

      // Single add
      bundle.addNewsletter(newsletter1);
      expect(bundle.newsletters).toEqual([newsletter1._id]);
      // Duplicate add
      bundle.addNewsletter(newsletter1);
      expect(bundle.newsletters).toEqual([newsletter1._id]);
      // Multiple add
      bundle.addNewsletter([newsletter2, newsletter1]);
      expect(bundle.newsletters).toEqual(expect.arrayContaining([newsletter1._id, newsletter2._id]));
      // No duplicates
      expect(bundle.newsletters?.length).toBe(2);
    });

    it('addArticle adds single and multiple article ids, prevents duplicates', async () => {
      const bundle = new Bundle({ user: '507f1f77bcf86cd799439011' });
      // Single add
      bundle.addArticle('aid1');
      expect(bundle.articles).toContain('aid1');
      // Duplicate add
      bundle.addArticle('aid1');
      expect(bundle.articles).toEqual(['aid1']);
      // Multiple add
      bundle.addArticle(['aid2', 'aid3', 'aid1', 'aid3', 'aid3']);
      expect(bundle.articles).toEqual(['aid1', 'aid2', 'aid3']);
    });

    it('addArticle adds Article objects, prevents duplicates', async () => {
      const bundle = new Bundle({ user: '507f1f77bcf86cd799439011' });
      const article1 = new Article({ url: 'http://example.com/a1' });
      const article2 = new Article({ url: 'http://example.com/a2' });
      // Single add
      bundle.addArticle(article1);
      expect(bundle.articles).toEqual([article1._id]);
      // Multiple add
      bundle.addArticle([article2, article1]);
      expect(bundle.articles).toEqual(expect.arrayContaining([article1._id, article2._id]));
      // No duplicates
      expect(bundle.articles?.length).toBe(2);
    });
  });
  describe('findNextToSend()', () => {
    let user: User;
    beforeEach(async () => {
      user = await new User({ email: 'user@example.com' }).save();
    });

    it('finds next unsent bundle by user object', async () => {
      const bundle1 = await new Bundle({ user, sendOn: new Date('2024-01-01') }).save();
      const bundle2 = await new Bundle({
        user,
        sendOn: new Date('2024-01-01'),
        processingStage: Bundle.ProcessingStages.SENT,
      }).save();
      const bundle3 = await new Bundle({ user, sendOn: new Date('2024-01-02') }).save();
      const next = await Bundle.findNextToSend(user);
      expect(next?._id).toStrictEqual(bundle1._id);
    });

    it('finds next unsent bundle by user id', async () => {
      const bundle1 = await new Bundle({ user, sendOn: new Date('2024-01-01') }).save();
      const bundle2 = await new Bundle({
        user,
        sendOn: new Date('2024-01-01'),
        processingStage: Bundle.ProcessingStages.SENT,
      }).save();
      const bundle3 = await new Bundle({ user, sendOn: new Date('2024-01-02') }).save();
      const next = await Bundle.findNextToSend(user._id as any);
      expect(next?._id).toStrictEqual(bundle1._id);
    });

    it('finds next unsent bundle by user email', async () => {
      const bundle1 = await new Bundle({ user, sendOn: new Date('2024-01-01') }).save();
      const bundle2 = await new Bundle({
        user,
        sendOn: new Date('2024-01-01'),
        processingStage: Bundle.ProcessingStages.SENT,
      }).save();
      const bundle3 = await new Bundle({ user, sendOn: new Date('2024-01-02') }).save();
      const next = await Bundle.findNextToSend(user.email);
      expect(next?._id).toStrictEqual(bundle1._id);
    });

    it('omits bundles with processingStage > 0', async () => {
      const bundle1 = await new Bundle({ user, sendOn: new Date('2024-01-01') }).save();
      let next = await Bundle.findNextToSend(user.email);
      expect(next?._id).toStrictEqual(bundle1._id);

      await bundle1.set({ processingStage: Bundle.ProcessingStages.PROCESSING_CONTENT }).save();
      next = await Bundle.findNextToSend(user.email);
      expect(next).toBeNull();

      await bundle1.set({ processingStage: Bundle.ProcessingStages.CONTENT_PROCESSED }).save();
      next = await Bundle.findNextToSend(user.email);
      expect(next).toBeNull();

      await bundle1.set({ processingStage: Bundle.ProcessingStages.SENT }).save();
      next = await Bundle.findNextToSend(user.email);
      expect(next).toBeNull();

      await bundle1.set({ processingStage: Bundle.ProcessingStages.ERROR }).save();
      next = await Bundle.findNextToSend(user.email);
      expect(next).toBeNull();

      await bundle1.set({ processingStage: Bundle.ProcessingStages.COMPLETED_WITH_ERRORS }).save();
      next = await Bundle.findNextToSend(user.email);
      expect(next).toBeNull();

      await bundle1.set({ processingStage: Bundle.ProcessingStages.NOT_STARTED }).save();
      next = await Bundle.findNextToSend(user.email);
      expect(next?._id).toStrictEqual(bundle1._id);
    });
  });

  describe('unpackNewsletters()', () => {
    let bundleId: typeof Bundle.prototype._id;

    beforeEach(async () => {
      const newsletter1 = await Newsletter.create({ content: 'Newsletter 1' });
      const newsletter2 = await Newsletter.create({ content: 'Newsletter 2' });

      const user = await User.create({ email: 'user@somewhere.ca' });
      const bundle = await Bundle.create({
        user,
        newsletters: [newsletter1, newsletter2],
      });
      await bundle.save();
      bundleId = bundle._id;
    });

    it('extracts all newsletters', async () => {
      vi.spyOn(Newsletter, 'extractArticles').mockResolvedValue(0);

      const bundle = (await Bundle.findById(bundleId)) as Bundle;
      await bundle._unpackNewsletters();

      // There should be at least 1 newsletters in the bundle (see beforeEach)
      expect(Newsletter.extractArticles).toHaveBeenCalledOnce();
    });

    it('requires bundle to be saved and unmodified', async () => {
      const user = await User.create({ email: 'user@domain.ca' });
      const bundle = new Bundle({ user });
      await expect(bundle._unpackNewsletters()).rejects.toThrow();

      await bundle.save();
      await expect(bundle._unpackNewsletters()).resolves.toBe(0);

      bundle.addArticle('aNewArticleId');
      await expect(bundle._unpackNewsletters()).rejects.toThrow();
    });

    it('works when pulling limited fields', async () => {
      vi.spyOn(Newsletter, 'extractArticles').mockResolvedValue(0);

      // Fetch only _id field
      const bundle = (await Bundle.findById(bundleId).select('_id')) as Bundle;
      await bundle._unpackNewsletters();

      expect(Newsletter.extractArticles).toHaveBeenCalledOnce();
    });
  });

  describe('processContent()', () => {
    let bundleId: typeof Bundle.prototype._id;

    beforeEach(async () => {
      vi.resetAllMocks();
      vi.spyOn(Article.prototype, 'process').mockResolvedValue(); // All articles succeed
      vi.spyOn(Newsletter, 'extractArticles').mockResolvedValue(0); // All newsletters succeed

      const article1 = await Article.create({ content: 'Article #1' });
      const article2 = await Article.create({ content: 'Article #2' });
      const article11 = await Article.create({ content: 'Article #11' });
      const article21 = await Article.create({ content: 'Article #21' });
      const article22 = await Article.create({ content: 'Article #22' });
      const newsletter1 = await Newsletter.create({ content: 'Newsletter 1', articles: [article11] });
      const newsletter2 = await Newsletter.create({ content: 'Newsletter 2', articles: [article21, article22] });

      const user = await User.create({ email: 'user@somewhere.ca' });
      const bundle = await Bundle.create({
        user,
        articles: [article1, article2],
        newsletters: [newsletter1, newsletter2],
      });
      await bundle.save();
      bundleId = bundle._id;
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('requires bundle to be saved and unmodified', async () => {
      const user = await User.create({ email: 'user@domain.ca' });
      const bundle = new Bundle({ user });
      await expect(bundle.processContent()).rejects.toThrow();

      await bundle.save();
      await expect(bundle.processContent()).resolves.toBe(0);

      bundle.addArticle('aNewArticleId');
      await expect(bundle.processContent()).rejects.toThrow();
    });

    it('works when pulling limited fields', async () => {
      // Fetch only _id field
      const bundle = (await Bundle.findById(bundleId).select('_id')) as Bundle;
      await bundle.processContent();

      // Assuming there are 5 articles total in the newsletters (see beforeEach)
      expect(Article.prototype.process).toHaveBeenCalledTimes(5);
    });

    it('should update `ProcessingStages` accordingly', async () => {
      const bundle = (await Bundle.findById(bundleId)) as Bundle;

      // mockImplementationOnce to check stage during processing
      vi.spyOn(Article.prototype, 'process')
        .mockImplementationOnce(async function (this: any) {
          const b = (await Bundle.findById(bundle._id)) as Bundle;
          expect(b.processingStage).toBe(Bundle.ProcessingStages.PROCESSING_CONTENT);
        })
        .mockResolvedValue();

      // After successful processing, stage should be CONTENT_PROCESSED
      await bundle.processContent();
      let updated = (await Bundle.findById(bundle._id)) as Bundle;
      expect(updated.processingStage).toBe(Bundle.ProcessingStages.CONTENT_PROCESSED);

      // Simulate one article failing
      vi.spyOn(Article.prototype, 'process').mockRejectedValueOnce(new Error('Article failed!'));
      await bundle.processContent();
      updated = (await Bundle.findById(bundle._id)) as Bundle;
      expect(updated.processingStage).toBe(Bundle.ProcessingStages.COMPLETED_WITH_ERRORS);

      // Force an error in processElements by mocking slice to throw
      vi.spyOn(Bundle.prototype as any, 'save').mockImplementationOnce(() => {
        throw new Error('Bundle failed!');
      });
      await expect(bundle.processContent()).resolves.toBe(-1);
      updated = (await Bundle.findById(bundle._id)) as Bundle;
      expect(updated.processingStage).toBe(Bundle.ProcessingStages.ERROR);
    });

    it('allow re-run regardless of stage', async () => {
      const bundle = (await Bundle.findById(bundleId)) as Bundle;

      // Set to various stages and ensure processArticles can still run
      for (const stage of Object.values(Bundle.ProcessingStages)) {
        // Skip invalid stages
        if (typeof stage !== 'number') continue;

        bundle.processingStage = stage;
        await bundle.save();
        await expect(bundle.processContent()).resolves.toBe(0);
      }
    });

    it('pulse check function is called for every batch', async () => {
      const pulseFn = vi.fn();
      const utils = await import('@lib/utils');
      const originalFn = utils.applyInBatches;

      vi.spyOn(utils, 'applyInBatches').mockImplementationOnce((items: any[], fn: any, opts: any) =>
        originalFn(items, fn, { ...opts, concurrency: 2 })
      );

      const bundle = (await Bundle.findById(bundleId)) as Bundle;
      await bundle.processContent({ pulsecheck: pulseFn });
      expect(pulseFn).toHaveBeenCalledTimes(3); // Assuming 5 items, concurrency 1 => 3 batches
    });
  });
});
