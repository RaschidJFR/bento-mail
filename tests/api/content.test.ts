import { describe, it, expect, vi } from 'vitest';
import { POST } from '@app/api/content/route';
import { Newsletter, Article } from '@lib/models';

function mockReq(body: any) {
  return {
    json: async () => body,
  };
}

describe('api/content POST', () => {
  it('should return 400 if parameters are missing', async () => {
    let req = mockReq({});
    let res = await POST(req as any);
    expect(res.status).toBe(400);

    req = mockReq({ content: '', format: 'html' });
    res = await POST(req as any);
    expect(res.status).toBe(400);

    req = mockReq({ content: 'Some content', format: 'invalid' });
    res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('should return 409 if newsletter already exists', async () => {
    const content = 'Unique newsletter content';
    const format = 'text';

    // Create newsletter directly in DB
    const existing = await Newsletter.create({ content });

    const analyzer = await import('@lib/ai-article-analyzer');
    vi.spyOn(analyzer, 'isArticleOrNewsletter').mockResolvedValue('newsletter');

    // Try to create again via API
    const req = mockReq({ content, format });
    const res = await POST(req as any);
    expect(res.status).toBe(409);

    const { result, type } = await res.json();
    expect(result._id).toStrictEqual(existing._id);
    expect(type).toBe('newsletter');
  });

  it('should return 409 if article already exists', async () => {
    const content = 'Unique newsletter content';
    const format = 'text';

    // Create newsletter directly in DB
    const existing = await Article.create({ content });

    const analyzer = await import('@lib/ai-article-analyzer');
    vi.spyOn(analyzer, 'isArticleOrNewsletter').mockResolvedValue('article');

    // Try to create again via API
    const req = mockReq({ content, format });
    const res = await POST(req as any);
    expect(res.status).toBe(409);

    const { result, type } = await res.json();
    expect(result._id).toStrictEqual(existing._id);
    expect(type).toBe('article');
  });

  it('should create newsletter and return 201', async () => {
    const content = 'Brand new newsletter content';
    const format = 'text';

    const analyzer = await import('@lib/ai-article-analyzer');
    vi.spyOn(analyzer, 'isArticleOrNewsletter').mockResolvedValue('newsletter');

    const req = mockReq({ content, format });
    const res = await POST(req as any);
    expect(res.status).toBe(201);

    const { result, type } = await res.json();
    expect(type).toBe('newsletter');
    expect(result.content).toBe(content);

    const created = await Newsletter.findById(result._id).lean();
    expect(created).toBeTruthy();
    expect(created?.content).toBe('Brand new newsletter content');
    expect(result).toMatchObject(created!);
  });
});
