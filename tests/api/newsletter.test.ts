import { describe, it, expect, vi } from 'vitest';
import { POST } from '@app/api/newsletter/route';
import { Newsletter } from '@lib/models';

function mockReq(body: any) {
  return {
    json: async () => body,
  };
}

describe('api/newsletter POST', () => {
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
    const existing = await Newsletter.create({
      content,
      articles: [],
      url: null,
      date: null,
      error: null,
      name: null,
    });

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

  it('should create article if content is a single-article newsletter', async () => {
    const content = 'A single article newsletter';
    const format = 'text';

    const analyzer = await import('@lib/ai-article-analyzer');
    vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'article', reason: '' });

    const req = mockReq({ content, format });
    const res = await POST(req as any);
    expect(res.status).toBe(201);

    const { result } = await res.json();
    expect(result.content).toBe(content);

    const created = await Newsletter.findById(result._id);
    expect(created).toBeTruthy();
    expect(created?.content).toBe(content);
    expect(result).toMatchObject(created!);
    expect(created?.articles || []).toHaveLength(0); // No articles should be created before calling Newsletter.processArticles()
  });

  it('should return 422 if content is not a newsletter nor an article', async () => {
    const content = 'Not a newsletter';
    const format = 'text';

    const analyzer = await import('@lib/ai-article-analyzer');
    vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'unknown', reason: '' });

    const req = mockReq({ content, format });
    const res = await POST(req as any);
    expect(res.status).toBe(422);
  });

  it('should create newsletter and return 201', async () => {
    const content = 'Brand new newsletter content';
    const format = 'text';

    const analyzer = await import('@lib/ai-article-analyzer');
    vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });

    const req = mockReq({ content, format });
    const res = await POST(req as any);
    expect(res.status).toBe(201);

    const { result } = await res.json();
    expect(result.content).toBe(content);

    const created = await Newsletter.findById(result._id);
    expect(created).toBeTruthy();
    expect(created?.content).toBe('Brand new newsletter content');
    expect(result).toMatchObject(created!);
  });

  it('triggers job to process new newsletter', async () => {
    const content = 'Some new content for job trigger';
    const format = 'text';

    // Mock analyzer to return 'newsletter'
    const analyzer = await import('@lib/ai-article-analyzer');
    vi.spyOn(analyzer, 'classifyContent').mockResolvedValue({ type: 'newsletter', reason: '' });

    // Mock scheduler and its chain methods
    const schedulerMock = {
      create: vi.fn(() => schedulerMock),
      unique: vi.fn(() => schedulerMock),
      schedule: vi.fn(() => schedulerMock),
      save: vi.fn().mockResolvedValue({}),
    };

    const workerModule = await import('@services/worker');
    vi.spyOn(workerModule, 'default').mockResolvedValue(schedulerMock as any);

    // Make the API call to create newsletter
    const req = mockReq({ content, format });
    await POST(req as any);

    // Verify that scheduler methods were called correctly
    expect(schedulerMock.create).toHaveBeenCalledWith(
      workerModule.JobNames.Newsletter.processArticles,
      expect.objectContaining({ id: expect.any(String) }),
    );
    expect(schedulerMock.schedule).toHaveBeenCalledWith('now');
    expect(schedulerMock.unique).toHaveBeenCalledWith(expect.objectContaining({ 'data.id': expect.any(String) }), {
      insertOnly: true,
    });
    expect(schedulerMock.save).toHaveBeenCalledOnce();
  });
});
