import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { User, IUser, Newsletter, Article, Reaction, Bundle } from '@lib/models';
import { ReactionsEnum } from '@lib/models/enums';
import { ObjectId } from 'mongodb';

function articleInput(data: { content: string; header?: string; lastError?: string }) {
  return {
    content: data.content,
    header: data.header ?? '',
    sourceName: '',
    url: null,
    date: null,
    coverImg: null,
    summaries: null,
    linkedArticles: null,
    lastError: data.lastError ?? null,
  };
}

function newsletterInput(data: { content: string; articles?: string[] }) {
  return {
    content: data.content,
    articles: data.articles ?? [],
    date: null,
    name: null,
    url: null,
    error: null,
  };
}

describe('Bundle', () => {
  it('should not create without an existing user', async () => {
    await expect(Bundle.create({ user: new ObjectId() } as any)).rejects.toThrow();
    const newUser = await User.create({ email: 'someone@somewhere.ca' } as any);
    await expect(Bundle.create({ user: newUser._id } as any)).resolves.toBeTruthy();
  });

  describe('AddElements', () => {
    let bundleId: string;

    beforeEach(async () => {
      const user = await User.create({ email: 'add@example.com' } as any);
      const bundle = await Bundle.create({ user: user._id } as any);
      bundleId = bundle._id;
    });

    it('addNewsletter add single and multiple newsletter ids, prevents duplicates', async () => {
      // Single add
      await Bundle.addNewsletter(bundleId, 'nid1');
      let ids = await Bundle.where({ _id: bundleId }).first().then(b => b?.newsletters || []);
      expect(ids).toEqual(['nid1']);
      // Duplicate add
      await Bundle.addNewsletter(bundleId, 'nid1');
      ids = await Bundle.where({ _id: bundleId }).first().then(b => b?.newsletters || []);
      expect(ids).toEqual(['nid1']);
      // Multiple add
      await Bundle.addNewsletter(bundleId, ['nid2', 'nid3', 'nid1', 'nid3', 'nid3']);
      ids = await Bundle.where({ _id: bundleId }).first().then(b => b?.newsletters || []);
      expect(ids).toEqual(['nid1', 'nid2', 'nid3']);
    });

    it('addArticle adds single and multiple article ids, prevents duplicates', async () => {
      // Single add
      await Bundle.addArticle(bundleId, 'aid1');
      let ids = await Bundle.where({ _id: bundleId }).first().then(b => b?.articles || []);
      expect(ids).toEqual(['aid1']);
      // Duplicate add
      await Bundle.addArticle(bundleId, 'aid1');
      ids = await Bundle.where({ _id: bundleId }).first().then(b => b?.articles || []);
      expect(ids).toEqual(['aid1']);
      // Multiple add
      await Bundle.addArticle(bundleId, ['aid2', 'aid3', 'aid1', 'aid3', 'aid3']);
      ids = await Bundle.where({ _id: bundleId }).first().then(b => b?.articles || []);
      expect(ids).toEqual(['aid1', 'aid2', 'aid3']);
    });
  });
  describe('findNextToSend()', () => {
    let user: IUser;
    beforeEach(async () => {
      user = await User.create({ email: 'user@example.com' } as any);
    });

    it('finds next unsent bundle by user id', async () => {
      const bundle1 = await Bundle.create({ user: user._id, sendOn: new Date('2024-01-01') } as any);
      await Bundle.create({
        user: user._id,
        sendOn: new Date('2024-01-01'),
        processingStage: Bundle.ProcessingStages.SENT,
      } as any);
      await Bundle.create({ user: user._id, sendOn: new Date('2024-01-02') } as any);
      const next = await Bundle.findNextToSend(user._id);
      expect(next?._id).toBe(String(bundle1._id));
    });

    it('finds next unsent bundle by user email', async () => {
      const bundle1 = await Bundle.create({ user: user._id, sendOn: new Date('2024-01-01') } as any);
      await Bundle.create({
        user: user._id,
        sendOn: new Date('2024-01-01'),
        processingStage: Bundle.ProcessingStages.SENT,
      } as any);
      await Bundle.create({ user: user._id, sendOn: new Date('2024-01-02') } as any);
      const next = await Bundle.findNextToSend(user.email);
      expect(next?._id).toBe(String(bundle1._id));
    });

    it('omits bundles with processingStage > 0', async () => {
      const bundle1 = await Bundle.create({ user: user._id, sendOn: new Date('2024-01-01') } as any);
      let next = await Bundle.findNextToSend(user.email);
      expect(next?._id).toBe(String(bundle1._id));

      const stagesToOmit = [
        Bundle.ProcessingStages.PROCESSING_CONTENT,
        Bundle.ProcessingStages.CONTENT_PROCESSED,
        Bundle.ProcessingStages.SENT,
        Bundle.ProcessingStages.ERROR,
        Bundle.ProcessingStages.COMPLETED_WITH_ERRORS,
      ];
      for (const stage of stagesToOmit) {
        await Bundle.where({ _id: bundle1._id }).update({ processingStage: stage });
        next = await Bundle.findNextToSend(user.email);
        expect(next).toBeNull();
      }

      await Bundle.where({ _id: bundle1._id }).update({ processingStage: Bundle.ProcessingStages.NOT_STARTED });
      next = await Bundle.findNextToSend(user.email);
      expect(next?._id).toBe(String(bundle1._id));
    });
  });

  describe('getUnreadArticles()', () => {
    let user: IUser;
    let otherUser: IUser;
    let bundleId: string;

    beforeEach(async () => {
      user = await User.create({ email: 'reader@example.com' } as any);
      otherUser = await User.create({ email: 'other-reader@example.com' } as any);

      // Direct bundle articles
      const directUnread = await Article.create(articleInput({ content: 'direct unread', header: 'Direct unread' }));
      const directUnread2 = await Article.create(articleInput({ content: 'direct unread 2', header: 'Direct unread 2' }));
      const directReacted = await Article.create(articleInput({ content: 'direct reacted', header: 'Direct reacted' }));
      const directWithError = await Article.create(articleInput({
        content: 'direct with error',
        header: 'Direct with error',
        lastError: 'failed processing',
      }));

      // Newsletter articles
      const newsletterUnread = await Article.create(articleInput({
        content: 'newsletter unread',
        header: 'Newsletter unread',
      }));
      const newsletterUnread2 = await Article.create(articleInput({
        content: 'newsletter unread 2',
        header: 'Newsletter unread 2',
      }));
      const newsletterReacted = await Article.create(articleInput({
        content: 'newsletter reacted',
        header: 'Newsletter reacted',
      }));
      const newsletterWithError = await Article.create(articleInput({
        content: 'newsletter with error',
        header: 'Newsletter with error',
        lastError: 'failed processing',
      }));

      const newsletter = await Newsletter.create(newsletterInput({
        content: 'Digest #1',
        articles: [newsletterUnread._id, newsletterUnread2._id, newsletterReacted._id, newsletterWithError._id],
      }));

      const bundle = await Bundle.create({
        user: user._id,
        articles: [directUnread._id, directUnread2._id, directReacted._id, directWithError._id],
        newsletters: [newsletter._id],
      } as any);
      bundleId = bundle._id;

      // User has already reacted to one direct and one newsletter article
      await Reaction.create({
        user: user._id,
        article: directReacted._id,
        reaction: ReactionsEnum.UPVOTE,
        date: null,
      } as any);
      await Reaction.create({
        user: user._id,
        article: newsletterReacted._id,
        reaction: ReactionsEnum.SKIP,
        date: null,
      } as any);

      // Reaction from another user must not affect unread results for `user`
      await Reaction.create({
        user: otherUser._id,
        article: directUnread._id,
        reaction: ReactionsEnum.SKIP,
        date: null,
      } as any);
    });

    it('returns only unread, error-free articles for both bundle and newsletter sources', async () => {
      const result = await Bundle.getUnreadArticles(bundleId);

      expect(result).toBeTruthy();
      expect(result?.user).toEqual(user._id);
      expect(result?.allArticleIds?.length).toBe(8);

      // Direct articles filtered to only unread + no lastError
      expect(result?.articles).toHaveLength(2);
      expect(result?.articles?.[0]?.header).toBe('Direct unread');
      expect(result?.articles?.[1]?.header).toBe('Direct unread 2');
      // Newsletter articles filtered to only unread + no lastError
      expect(result?.newsletters).toHaveLength(1);
      expect(result?.newsletters?.[0]?.articles).toHaveLength(2);
      expect(result?.newsletters?.[0]?.articles?.[0]?.header).toBe('Newsletter unread');
      expect(result?.newsletters?.[0]?.articles?.[1]?.header).toBe('Newsletter unread 2');
    });

    it('returns null when bundle does not exist', async () => {
      const nonexistentBundleId = new ObjectId().toString();
      const result = await Bundle.getUnreadArticles(nonexistentBundleId);
      expect(result).toBeNull();
    });
  });

  describe('unpackNewsletters()', () => {
    let bundleId: string;

    beforeEach(async () => {
      const newsletter1 = await Newsletter.create(newsletterInput({ content: 'Newsletter 1' }));
      const newsletter2 = await Newsletter.create(newsletterInput({ content: 'Newsletter 2' }));

      const user = await User.create({ email: 'user@somewhere.ca' } as any);
      const bundle = await Bundle.create({
        user: user._id,
        newsletters: [newsletter1._id, newsletter2._id],
      } as any);
      bundleId = bundle._id;
    });

    it('extracts all newsletters', async () => {
      vi.spyOn(Newsletter, 'extractArticlesBatch').mockResolvedValue(0);

      await Bundle.unpackNewsletters(bundleId);

      // There should be at least 1 newsletters in the bundle (see beforeEach)
      expect(Newsletter.extractArticlesBatch).toHaveBeenCalledOnce();
    });

    it('throws when bundle does not exist', async () => {
      await expect(Bundle.unpackNewsletters('nonexistentId')).rejects.toThrow();
    });
  });

  describe('processContent()', () => {
    let bundleId: string;

    beforeEach(async () => {
      vi.resetAllMocks();
      vi.spyOn(Article, 'process').mockResolvedValue(); // All articles succeed
      vi.spyOn(Newsletter, 'extractArticlesBatch').mockResolvedValue(0); // All newsletters succeed

      const article1 = await Article.create(articleInput({ content: 'Article #1' }));
      const article2 = await Article.create(articleInput({ content: 'Article #2' }));
      const article11 = await Article.create(articleInput({ content: 'Article #11' }));
      const article21 = await Article.create(articleInput({ content: 'Article #21' }));
      const article22 = await Article.create(articleInput({ content: 'Article #22' }));
      const newsletter1 = await Newsletter.create(newsletterInput({ content: 'Newsletter 1', articles: [article11._id] }));
      const newsletter2 = await Newsletter.create(newsletterInput({ content: 'Newsletter 2', articles: [article21._id, article22._id] }));

      const user = await User.create({ email: 'user@somewhere.ca' } as any);
      const bundle = await Bundle.create({
        user: user._id,
        articles: [article1._id, article2._id],
        newsletters: [newsletter1._id, newsletter2._id],
      } as any);
      bundleId = bundle._id;
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('throws when bundle does not exist', async () => {
      await expect(Bundle.processContent('nonexistentId')).rejects.toThrow();
    });

    it('processes all articles across direct and newsletter refs', async () => {
      await Bundle.processContent(bundleId);

      // Assuming there are 5 articles total in the newsletters (see beforeEach)
      expect(Article.process).toHaveBeenCalledTimes(5);
    });

    it('should update `ProcessingStages` accordingly', async () => {
      // mockImplementationOnce to check stage during processing
      vi.spyOn(Article, 'process')
        .mockImplementationOnce(async () => {
          const b = await Bundle.where({ _id: bundleId }).first();
          expect(b?.processingStage).toBe(Bundle.ProcessingStages.PROCESSING_CONTENT);
        })
        .mockResolvedValue();

      // After successful processing, stage should be CONTENT_PROCESSED
      await Bundle.processContent(bundleId);
      let updated = await Bundle.where({ _id: bundleId }).first();
      expect(updated?.processingStage).toBe(Bundle.ProcessingStages.CONTENT_PROCESSED);

      // Simulate one article failing
      vi.spyOn(Article, 'process').mockRejectedValueOnce(new Error('Article failed!'));
      await Bundle.processContent(bundleId);
      updated = await Bundle.where({ _id: bundleId }).first();
      expect(updated?.processingStage).toBe(Bundle.ProcessingStages.COMPLETED_WITH_ERRORS);

      // Force a fatal error
      vi.spyOn(Newsletter, 'extractArticlesBatch').mockRejectedValueOnce(new Error('Bundle failed!'));
      await expect(Bundle.processContent(bundleId)).resolves.toBe(-1);
      updated = await Bundle.where({ _id: bundleId }).first();
      expect(updated?.processingStage).toBe(Bundle.ProcessingStages.ERROR);
    });

    it('allow re-run regardless of stage', async () => {
      // Set to various stages and ensure processArticles can still run
      for (const stage of Object.values(Bundle.ProcessingStages)) {
        // Skip invalid stages
        if (typeof stage !== 'number') continue;

        await Bundle.where({ _id: bundleId }).update({ processingStage: stage });
        await expect(Bundle.processContent(bundleId)).resolves.toBe(0);
      }
    });

    it('pulse check function is called for every batch', async () => {
      const pulseFn = vi.fn();
      const utils = await import('@lib/utils');
      const originalFn = utils.applyInBatches;

      vi.spyOn(utils, 'applyInBatches').mockImplementationOnce((items: any[], fn: any, opts: any) =>
        originalFn(items, fn, { ...opts, concurrency: 2 })
      );

      await Bundle.processContent(bundleId, { pulsecheck: pulseFn });
      expect(pulseFn).toHaveBeenCalledTimes(3); // Assuming 5 items, concurrency 2 => 3 batches
    });
  });
});
