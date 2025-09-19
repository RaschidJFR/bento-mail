import { describe, it, expect, beforeEach } from 'vitest';
import { POST, RequestBody } from '@app/api/bundle/route';
import { Bundle, User } from '@lib/models';

function mockReq(body: Partial<RequestBody>) {
  return {
    json: async () => body,
  };
}

describe('POST /api/bundle', () => {
  let user: User;

  beforeEach(async () => {
    // Create test user
    user = await User.create({ email: 'foo@bar.com' });
  });

  it('returns 400 if email or newsletter/article missing', async () => {
    let req = mockReq({ email: 'user@domain.com', newsletters: [], articles: [] });
    let res = await POST(req as any);
    expect(res.status).toBe(400);
    req = mockReq({ email: '', newsletters: ['abcdefg'], articles: [] });
    res = await POST(req as any);
    expect(res.status).toBe(400);
    req = mockReq({ email: 'user@domain.com', newsletters: [], articles: [] });
    res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 if user not found', async () => {
    const req = mockReq({ email: 'notfound@bar.com', newsletters: ['nid'], articles: [] });
    const res = await POST(req as any);
    expect(res.status).toBe(404);
  });

  it('returns 200 if newsletter already in bundle', async () => {
    await Bundle.create({ user: user._id, newsletters: ['nid'], articles: [], sent: false });
    const req = mockReq({ email: user.email, newsletters: ['nid'], articles: [] });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('returns 200 if article already in bundle', async () => {
    await Bundle.create({ user: user._id, newsletters: [], articles: ['aid'], sent: false });
    const req = mockReq({ email: user.email, newsletters: [], articles: ['aid'] });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  it('adds newsletter to existing bundle', async () => {
    const bundle = await Bundle.create({ user: user._id, newsletters: [], articles: [], sent: false });
    const req = mockReq({ email: user.email, newsletters: ['nid'], articles: [] });
    const res = await POST(req as any);
    const updated = await Bundle.findById(bundle._id);
    expect(res.status).toBe(200);
    expect(updated?.newsletters).toContain('nid');
  });

  it('adds article to existing bundle', async () => {
    const bundle = await Bundle.create({ user: user._id, newsletters: [], articles: [], sent: false });
    const req = mockReq({ email: user.email, newsletters: [], articles: ['aid'] });
    const res = await POST(req as any);
    const updated = await Bundle.findById(bundle._id);
    expect(res.status).toBe(200);
    expect(updated?.articles).toContain('aid');
  });

  it('creates new bundle if none exists (newsletter)', async () => {
    const req = mockReq({ email: user.email, newsletters: ['nid'], articles: [] });
    const res = await POST(req as any);
    const { result } = await res.json();
    const bundle = await Bundle.findById(result._id);
    expect(bundle!.newsletters).toContain('nid');
    expect(res.status).toBe(201);
    expect(bundle!.user._id).toStrictEqual(user._id);
  });

  it('creates new bundle if none exists (article)', async () => {
    const req = mockReq({ email: user.email, newsletters: [], articles: ['aid'] });
    const res = await POST(req as any);
    const { result } = await res.json();
    const bundle = await Bundle.findById(result._id);
    expect(res.status).toBe(201);
    expect(bundle!.articles).toContain('aid');
    expect(bundle!.user._id).toStrictEqual(user._id);
  });
});
