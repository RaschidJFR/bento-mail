import { describe, it, expect } from 'vitest';
import { POST } from '@app/api/newsletter/route';
import { Newsletter } from '@lib/models';

function mockReq(body: any) {
  return {
    json: async () => body,
  };
}

describe('api/user POST', () => {
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

    // Try to create again via API
    const req = mockReq({ content, format });
    const res = await POST(req as any);
    expect(res.status).toBe(409);
    const { data } = await res.json();
    expect(data.result._id).toBe(existing._id);

    const { result } = await res.json();
    expect(result._id).toStrictEqual(existing._id);
  });

  it('should create newsletter and return 201', async () => {
    const content = 'Brand new newsletter content';
    const format = 'text';

    const req = mockReq({ content, format });
    const res = await POST(req as any);
    expect(res.status).toBe(201);

    const { result, type } = await res.json();
    expect(type).toBe('newsletter');
    expect(result.content).toBe(content);

    const created = await Newsletter.findById(result._id);
    expect(created).toBeTruthy();
    expect(result).toMatchObject(created!);
  });
});
