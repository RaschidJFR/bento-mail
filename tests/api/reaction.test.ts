import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@app/api/reaction/route';
import { Bundle, User, Article, Reaction } from '@lib/models';

function mockReq(url: string) {
  return { url } as any;
}

describe('GET /api/reaction', () => {
  let user: User;
  let article: Article;
  let bundle: Bundle;

  beforeEach(async () => {
    user = await User.create({ email: 'foo@bar.com' });
    article = await Article.create({ content: 'Test Article' });
    bundle = await Bundle.create({ user: user._id, articles: [article._id], newsletters: [] });
  });

  it('returns 400 if user id missing (user+article)', async () => {
    const req = mockReq('http://localhost/api/reaction?article=' + article._id);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 if user not found (user+article)', async () => {
    const req = mockReq(`http://localhost/api/reaction?user=000000000000000000000000&article=${article._id}`);
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns 400 if article id missing (user+article)', async () => {
    const req = mockReq(`http://localhost/api/reaction?user=${user._id}`);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 if article not found (user+article)', async () => {
    const req = mockReq(`http://localhost/api/reaction?user=${user._id}&article=000000000000000000000000`);
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns reactions for user+article', async () => {
    const reactionData = { user: user.id, article: article.id, reaction: 1, date: null };
    await Reaction.create(reactionData);
    const req = mockReq(`http://localhost/api/reaction?user=${user._id}&article=${article._id}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toMatchObject([reactionData]);
  });

  it('returns 404 if bundle not found', async () => {
    const req = mockReq('http://localhost/api/reaction?bundle=000000000000000000000000');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns reactions for bundle', async () => {
    const reactionData = { user: user.id, article: article.id, reaction: 1, date: null };
    await Reaction.create(reactionData);
    const req = mockReq(`http://localhost/api/reaction?bundle=${bundle._id}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result).toMatchObject([reactionData]);
  });
});
