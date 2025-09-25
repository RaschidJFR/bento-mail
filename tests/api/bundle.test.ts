import { describe, it, expect, beforeEach } from 'vitest';
import { POST, UPDATE } from '@app/api/bundle/route';
import { Bundle, User } from '@lib/models';
import { RequestBody as POSTReqBody } from '@app/api/bundle/post';
import { UpdateRequestBody as UPDATEReqBody } from '@app/api/bundle/update';

function mockPostReq(body: Partial<POSTReqBody>) {
  return {
    json: async () => body,
  };
}

function mockUpdateReq(body: Partial<UPDATEReqBody>) {
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

  it('creates new bundle if none exists (newsletter)', async () => {
    const req = mockPostReq({ email: user.email, newsletters: ['nid'], articles: [] });
    const res = await POST(req as any);
    const { result } = await res.json();
    const bundle = await Bundle.findById(result._id);
    expect(bundle!.newsletters).toContain('nid');
    expect(res.status).toBe(201);
    expect(bundle!.user._id).toStrictEqual(user._id);
  });

  it('creates new bundle if none exists (article)', async () => {
    const req = mockPostReq({ email: user.email, newsletters: [], articles: ['aid'] });
    const res = await POST(req as any);
    const { result } = await res.json();
    const bundle = await Bundle.findById(result._id);
    expect(res.status).toBe(201);
    expect(bundle!.articles).toContain('aid');
    expect(bundle!.user._id).toStrictEqual(user._id);
  });
});

describe('UPDATE /api/bundle', () => {
  let bundle: any;
  let user: User;

  beforeEach(async () => {
    user = await User.create({ email: 'foo@bar.com' });
    bundle = await Bundle.create({ user: user._id }) as Bundle;
  });

  it('returns 400 if _id is missing', async () => {
    const req = mockUpdateReq({ reactions: [] });
    const res = await UPDATE(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 if reactions format is invalid', async () => {
    const req = mockUpdateReq({ _id: bundle._id, reactions: [{ article: '', reaction: 1 }] });
    const res = await UPDATE(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 if unsupported keys are present', async () => {
    const req = mockUpdateReq({ _id: bundle._id, reactions: [], foo: 'bar' } as any);
    const res = await UPDATE(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 if bundle not found', async () => {
    // Use a valid but non-existent ObjectId
    const req = mockUpdateReq({ _id: '000000000000000000000000', reactions: [] });
    const res = await UPDATE(req as any);
    expect(res.status).toBe(404);
  });

  it('updates reactions and returns 200', async () => {
    const reactions = [{ article: '123', reaction: 2 }];
    const req = mockUpdateReq({ _id: String(bundle._id), reactions });
    
    const res = await UPDATE(req as any);
    expect(res.status).toBe(200);
    
    const data = await res.json();
    expect(data.result.reactions).toEqual(reactions);

    const updated = await Bundle.findById(bundle._id);
    expect(updated?.reactions).toEqual(reactions);
  });
});
