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

  it('triggers job to process new newsletter/articles', async () => {
    const content = 'Some new content for job trigger';
    const format = 'text';

    // Mock analyzer to return 'newsletter'
    const analyzer = await import('@lib/ai-article-analyzer');
    const isArticleOrNewsletter = vi.spyOn(analyzer, 'isArticleOrNewsletter').mockResolvedValue('newsletter');

    // Mock agenda and its chain methods
    const agendaMock = {
      create: vi.fn(() => agendaMock),
      unique: vi.fn(() => agendaMock),
      schedule: vi.fn(() => agendaMock),
      save: vi.fn().mockResolvedValue({}),
    };

    const workerModule = await import('@services/worker');
    vi.spyOn(workerModule, 'default').mockResolvedValue(agendaMock as any);

    // Make the API call to create content
    const req = mockReq({ content, format });
    await POST(req as any);

    // Verify that agenda methods were called correctly
    expect(agendaMock.create).toHaveBeenCalledWith(
      workerModule.JobNames.Newsletter.processArticles,
      expect.objectContaining({ id: expect.any(String) })
    );
    expect(agendaMock.schedule).toHaveBeenCalledWith('now');
    expect(agendaMock.unique).toHaveBeenCalledWith(expect.objectContaining({ 'data.id': expect.any(String) }), {
      insertOnly: true,
    });
    expect(agendaMock.save).toHaveBeenCalledOnce();

    // Reset mock to test 'article' path
    vi.clearAllMocks();
    isArticleOrNewsletter.mockResolvedValue('article');

    // Make the API call to create an article
    const req2 = mockReq({ content: content + ' article', format });
    await POST(req2 as any);

    // Verify that agenda methods were called correctly for article
    expect(agendaMock.create).toHaveBeenCalledWith(
      workerModule.JobNames.Article.process,
      expect.objectContaining({ id: expect.any(String) })
    );
    expect(agendaMock.schedule).toHaveBeenCalledWith('now');
    expect(agendaMock.unique).toHaveBeenCalledWith(expect.objectContaining({ 'data.id': expect.any(String) }), {
      insertOnly: true,
    });
    expect(agendaMock.save).toHaveBeenCalledOnce(); // Called twice now
  });
});
