import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { POST as POST_CHAT } from '@app/api/article/[id]/chat/route';
import { Article } from '@lib/models/article';

vi.mock('@openrouter/sdk', () => ({
  OpenRouter: vi.fn().mockImplementation(() => ({
    chat: {
      send: vi.fn().mockResolvedValue({
        id: 'chatcmpl-123',
        created: Date.now(),
        model: 'openai/gpt-5-mini',
        object: 'chat.completion',
        system_fingerprint: 'fp_123',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'This is a test response about the article.',
            },
          },
        ],
      }),
    },
  })),
}));

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

  it('returns 200 with chat response on success', async () => {
    const req = mockReq({
      messages: [
        { role: 'user', content: 'What is this article about?' },
        { role: 'assistant', content: 'It is about...' },
      ],
    });
    const res = await POST_CHAT(req, { params: Promise.resolve({ id: article._id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.response).toBeDefined();
    expect(data.response.content).toBe('This is a test response about the article.');
  });

  it('handles invalid message role', async () => {
    const req = mockReq({
      messages: [
        { role: 'invalid_role', content: 'Some message' },
      ],
    });
    const res = await POST_CHAT(req, { params: Promise.resolve({ id: article._id }) });
    expect(res.status).toBe(500);
  });
});
