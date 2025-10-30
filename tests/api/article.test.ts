import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { POST as POST_PROCESS } from '@app/api/article/[id]/process/route';
import { POST as POST_CREATE } from '@app/api/article/route';
import { Article } from '@lib/models/article';

function mockReq(body: any) {
  return {
    json: async () => body,
  } as any;
}

describe('POST /api/article', () => {
  beforeEach(async () => {
    const aiAnalyzer = await import('@lib/ai-article-analyzer');
    vi.spyOn(aiAnalyzer, 'isArticleOrNewsletter').mockResolvedValue('article');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates article successfully', async () => {
    const req = mockReq({ content: 'New article content', format: 'text' });
    const res = await POST_CREATE(req as any);
    expect(res.status).toBe(201);
    const data = await res.json();
    const article = await Article.findById(data.result._id).lean();
    expect(article?.content).toBe('New article content');
  });

  it('returns 400 for missing content', async () => {
    const req = mockReq({ format: 'text' });
    const res = await POST_CREATE(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 409 if article already exists', async () => {
    const existing = await Article.create({ content: 'Existing content' });
    const req = mockReq({ content: 'Existing content', format: 'text' });
    const res = await POST_CREATE(req as any);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.type).toBe('article');
    expect(data.result._id).toBe(existing._id);
  });
});

describe('POST /api/article/[id]/process', () => {
  let article: Article;

  beforeEach(async () => {
    article = await Article.create({ content: 'Test Article' });
  });

  it('returns 404 if article not found', async () => {
    const req = mockReq({});
    const res = await POST_PROCESS(req, { params: Promise.resolve({ id: '000000000000000000000000' }) });
    expect(res.status).toBe(404);
  });

  it('schedules job and returns 202', async () => {
    const req = mockReq({ force: false, generateImage: false });

    // Mock agenda and its chain methods
    const agendaMock = {
      create: vi.fn(() => agendaMock),
      unique: vi.fn(() => agendaMock),
      schedule: vi.fn(() => agendaMock),
      save: vi.fn().mockResolvedValue({
        attrs: { data: { _id: 'jobid123' } },
      }),
    };
    const workerModule = await import('@services/worker');
    vi.spyOn(workerModule, 'default').mockResolvedValue(agendaMock as any);

    const res = await POST_PROCESS(req, { params: Promise.resolve({ id: article._id }) });
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.result).toEqual({ data: { _id: 'jobid123' } });

    // Verify that agenda methods were called correctly
    expect(agendaMock.create).toHaveBeenCalledWith(
      workerModule.JobNames.Article.process,
      expect.objectContaining({ id: article._id, force: false, generateImage: false })
    );
    expect(agendaMock.schedule).toHaveBeenCalledWith('now');
    expect(agendaMock.unique).toHaveBeenCalledWith(expect.objectContaining({ 'data.id': article._id }), {
      insertOnly: true,
    });
    expect(agendaMock.save).toHaveBeenCalledOnce();
  });
});
