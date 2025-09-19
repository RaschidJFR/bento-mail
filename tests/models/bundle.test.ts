import { describe, expect, it } from 'vitest';
import { User, Bundle, Newsletter, Article } from '@lib/models';

describe('Bundle', () => {
  it('should not save without a user', async () => {
    const bundle = new Bundle();
    await expect(bundle.save()).rejects.toThrow();
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
    it('finds next unsent bundle by user object', async () => {
      const user = await new User({ email: 'user@example.com' }).save();
      const bundle1 = await new Bundle({ user, sendOn: new Date('2024-01-01') }).save();
      const bundle2 = await new Bundle({ user, sendOn: new Date('2024-01-01'), sent: true }).save();
      const bundle3 = await new Bundle({ user, sendOn: new Date('2024-01-02') }).save();
      const next = await Bundle.findNextToSend(user);
      expect(next?._id).toStrictEqual(bundle1._id);
    });

    it('finds next unsent bundle by user id', async () => {
      const user = await new User({ email: 'user@example.com' }).save();
      const bundle1 = await new Bundle({ user, sendOn: new Date('2024-01-01') }).save();
      const bundle2 = await new Bundle({ user, sendOn: new Date('2024-01-01'), sent: true }).save();
      const bundle3 = await new Bundle({ user, sendOn: new Date('2024-01-02') }).save();
      const next = await Bundle.findNextToSend(user._id as any);
      expect(next?._id).toStrictEqual(bundle1._id);
    });

    it('finds next unsent bundle by user email', async () => {
      const user = await new User({ email: 'user@example.com' }).save();
      const bundle1 = await new Bundle({ user, sendOn: new Date('2024-01-01') }).save();
      const bundle2 = await new Bundle({ user, sendOn: new Date('2024-01-01'), sent: true }).save();
      const bundle3 = await new Bundle({ user, sendOn: new Date('2024-01-02') }).save();
      const next = await Bundle.findNextToSend('user@example.com');
      expect(next?._id).toStrictEqual(bundle1._id);
    });
  });
});
