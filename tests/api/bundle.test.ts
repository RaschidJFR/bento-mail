import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET } from '@app/api/bundle/route';
import { Bundle, User } from '@lib/models';
import { RequestBody as POSTReqBody } from '@app/api/bundle/post';

// --- Mock request helpers ---
function mockGetReq(userEmail: string | undefined) {
  return {
    url: `http://localhost/api/bundle${userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : ''}`,
  };
}

function mockPostReq(body: Partial<POSTReqBody>) {
  return {
    json: async () => body,
  };
}
describe('/api/bundle', () => {
  describe('GET', () => {
    let user: User;
    beforeEach(async () => {
      // Create test user
      user = await User.create({ email: 'foo@bar.com' });
    });

    it('returns 400 if userEmail is missing or invalid', async () => {
      let req = mockGetReq(undefined);
      let res = await GET(req as any);
      expect(res.status).toBe(400);
      req = mockGetReq('');
      res = await GET(req as any);
      expect(res.status).toBe(400);
    });

    it('returns 404 if user not found', async () => {
      const req = mockGetReq('notfound@bar.com');
      const res = await GET(req as any);
      expect(res.status).toBe(404);
    });

    it('returns 200 and bundle if found', async () => {
      const bundle = await Bundle.create({ user: user._id, newsletters: ['nid'], articles: [], sent: false });
      const req = mockGetReq(user.email);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const { result } = await res.json();
      expect(result).toBeTruthy();
      expect(result.newsletters).toContain('nid');
    });

    it('returns 200 and result null if no bundle found', async () => {
      const req = mockGetReq(user.email);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const { result } = await res.json();
      expect(result).toBeNull();
    });

    it('can get a bundle for a user by their aliasEmail', async () => {
      await user.set({ aliasEmail: 'alias@bar.com' }).save();
      const bundle = await Bundle.create({ user: user._id, newsletters: ['nid'], articles: [], sent: false });

      const req = mockGetReq(user.aliasEmail);
      const res = await GET(req as any);
      expect(res.status).toBe(200);
      const { result } = await res.json();
      expect(result.user._id).toStrictEqual(String(bundle.user._id));
    });
  });

  describe('POST', () => {
    let user: User;

    beforeEach(async () => {
      // Create test user
      user = await User.create({ email: 'foo@bar.com' });
    });

    it('returns 400 if email or newsletter/article missing', async () => {
      let req = mockPostReq({ email: 'user@domain.com', newsletters: [], articles: [] });
      let res = await POST(req as any);
      expect(res.status).toBe(400);
      req = mockPostReq({ email: '', newsletters: ['abcdefg'], articles: [] });
      res = await POST(req as any);
      expect(res.status).toBe(400);
      req = mockPostReq({ email: 'user@domain.com', newsletters: [], articles: [] });
      res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it('returns 404 if user not found', async () => {
      const req = mockPostReq({ email: 'notfound@bar.com', newsletters: ['nid'], articles: [] });
      const res = await POST(req as any);
      expect(res.status).toBe(404);
    });

    it('returns 200 if newsletter already in bundle', async () => {
      await Bundle.create({ user: user._id, newsletters: ['nid'], articles: [], sent: false });
      const req = mockPostReq({ email: user.email, newsletters: ['nid'], articles: [] });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
    });

    it('returns 200 if article already in bundle', async () => {
      await Bundle.create({ user: user._id, newsletters: [], articles: ['aid'], sent: false });
      const req = mockPostReq({ email: user.email, newsletters: [], articles: ['aid'] });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
    });

    it('adds newsletter to existing bundle', async () => {
      const bundle = await Bundle.create({ user: user._id, newsletters: [], articles: [], sent: false });
      const req = mockPostReq({ email: user.email, newsletters: ['nid'], articles: [] });
      const res = await POST(req as any);
      const updated = await Bundle.findById(bundle._id);
      expect(res.status).toBe(200);
      expect(updated?.newsletters).toContain('nid');
    });

    it('adds article to existing bundle', async () => {
      const bundle = await Bundle.create({ user: user._id, newsletters: [], articles: [], sent: false });
      const req = mockPostReq({ email: user.email, newsletters: [], articles: ['aid'] });
      const res = await POST(req as any);
      const updated = await Bundle.findById(bundle._id);
      expect(res.status).toBe(200);
      expect(updated?.articles).toContain('aid');
    });

    it('receives a newsletter and creates a new bundle if none exists', async () => {
      const req = mockPostReq({ email: user.email, newsletters: ['nid'], articles: [] });
      const res = await POST(req as any);
      const { result } = await res.json();
      const bundle = await Bundle.findById(result._id);
      expect(bundle!.newsletters).toContain('nid');
      expect(res.status).toBe(201);
      expect(bundle!.user._id).toStrictEqual(user._id);
    });

    it('receives an article and creates a new bundle if none exists', async () => {
      const req = mockPostReq({ email: user.email, newsletters: [], articles: ['aid'] });
      const res = await POST(req as any);
      const { result } = await res.json();
      const bundle = await Bundle.findById(result._id);
      expect(res.status).toBe(201);
      expect(bundle!.articles).toContain('aid');
      expect(bundle!.user._id).toStrictEqual(user._id);
    });

    it('can create a bundle for a user with their aliasEmail', async () => {
      const aliasUser = await User.create({ email: 'email@bar.com', aliasEmail: 'alias@bar.com' });
      const req = mockPostReq({ email: aliasUser.aliasEmail, newsletters: ['nid'], articles: [] });
      const res = await POST(req as any);
      expect(res.status).toBe(201);
      const { result } = await res.json();
      expect(result.user).toStrictEqual(String(aliasUser._id));
    });
  });
});
