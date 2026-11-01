import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { POST as POST_CHAT } from '@app/api/article/[id]/chat/route';
import { Article } from '@lib/models/article';

function mockReq(body: any) {
  return {
    json: async () => body,
  } as any;
}

describe('POST /api/article/[id]/chat', () => {
  let article: any;

  beforeEach(async () => {
    article = await Article.create({
      content: 'Test article content with multiple paragraphs. This is the first paragraph.',
      header: 'Test Article',
      sourceName: 'Test Source',
      url: 'https://example.com/article',
      date: new Date().toISOString().split('T')[0],
      coverImg: null,
      summaries: {
        oneliner: 'Test article summary',
        overview: 'A comprehensive overview of the test article',
        details: 'Detailed information about the test article including key points and evidence',
      },
      linkedArticles: null,
      lastError: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 if article not found', async () => {
    const req = mockReq({ messages: [{ role: 'user', content: 'What is this article about?' }] });
    const res = await POST_CHAT(req, { params: Promise.resolve({ id: '000000000000000000000000' }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 if messages array is empty', async () => {
    const req = mockReq({ messages: [] });
    const res = await POST_CHAT(req, { params: Promise.resolve({ id: article._id }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 if messages is missing', async () => {
    const req = mockReq({});
    const res = await POST_CHAT(req, { params: Promise.resolve({ id: article._id }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid message role', async () => {
    const req = mockReq({
      messages: [
        { role: 'invalid_role', content: 'Some message' },
      ],
    });
    const res = await POST_CHAT(req, { params: Promise.resolve({ id: article._id }) });
    expect(res.status).toBe(400);
  });
});
