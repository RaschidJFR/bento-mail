import { describe, expect, it, beforeEach, vi } from 'vitest';
import { POST } from '../../src/app/api/user/route';
import { User } from '@lib/models';
import type { NextRequest } from 'next/server';

function mockRequest(body: any) {
  return {
    json: async () => body,
  } as NextRequest;
}

describe('api/user POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if email is missing', async () => {
    const req = mockRequest({});
    const res: any = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/email/);
  });

  it('should return 409 if user already exists', async () => {
    const user = await User.create({ email: 'test@example.com' });
    const req = mockRequest({ email: 'test@example.com' });
    const res: any = await POST(req);
    const { result, error } = await res.json();
    expect(res.status).toBe(409);
    expect(result._id).toBe(user._id.toString());
    expect(error).toMatch(/already exists/);
  });

  it('should create user and return 201', async () => {
    const req = mockRequest({ email: 'new@example.com' });
    const res: any = await POST(req);
    expect(res.status).toBe(201);
    const { result } = await res.json();
    const user = await User.findById(result._id);
    expect(user!.email).toBe('new@example.com');
  });
});
