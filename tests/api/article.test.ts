import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@app/api/article/[id]/process/route';
import { Article } from '@lib/models/article';

function mockReq(body: any) {
  return {
    json: async () => body,
  } as any;
}

describe('POST /api/article/[id]/process', () => {
  let article: Article;

  beforeEach(async () => {
    article = await Article.create({ content: 'Test Article' });
  });

  it('returns 404 if article not found', async () => {
    const req = mockReq({});
    const res = await POST(req, { params: { id: '000000000000000000000000' } });
    expect(res.status).toBe(404);
  });

  it('schedules job and returns 201', async () => {
    const req = mockReq({ force: true, generateImage: true });

    // Mock agenda and its chain methods
    const agendaMock = {
      create: vi.fn(() => agendaMock),
      unique: vi.fn(() => agendaMock),
      schedule: vi.fn(() => agendaMock),
      save: vi.fn().mockResolvedValue({}),
    };
    const workerModule = await import('@services/worker');
    vi.spyOn(workerModule, 'default').mockResolvedValue(agendaMock as any);

    const res = await POST(req, { params: { id: article._id } });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.result).toBeDefined();

    // Verify that agenda methods were called correctly
    expect(agendaMock.create).toHaveBeenCalledWith(
      workerModule.JobNames.Article.process,
      expect.objectContaining({ id: article._id, force: true, generateImage: true })
    );
    expect(agendaMock.schedule).toHaveBeenCalledWith('now');
    expect(agendaMock.unique).toHaveBeenCalledWith(expect.objectContaining({ 'data.id': article._id }), {
      insertOnly: true,
    });
    expect(agendaMock.save).toHaveBeenCalledOnce();
  });
});
