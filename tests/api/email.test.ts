import { describe, it, expect, vi, beforeEach, Mock, afterEach } from 'vitest';
import { POST } from '@app/api/email/route';
import { processNewEmail } from '@services/email';
import dns from 'node:dns/promises';

function mockRequest({ json, headers }: { json?: any; headers?: any }) {
  return {
    json: vi.fn().mockResolvedValue(json),
    headers: {
      get: (key: string) => (headers && headers[key]) || null,
    },
  } as any;
}

describe('POST /api/email', () => {
  const parsedMail = { subject: 'Test', text: 'Hello' };
  const allowedIp = '1.2.3.4';
  const allowedHosts = ['mydomain.io', 'anotherdomain.com'];
  const forbiddenHost = 'evil.com';

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ALLOWED_EMAIL_HOSTS', allowedHosts.join(','));

    vi.mock('@services/email', () => ({
      processNewEmail: vi.fn(),
    }));
    vi.mock('node:dns/promises', () => ({
      default: { reverse: vi.fn(() => allowedHosts) },
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it('returns 403 if x-forwarded-for is missing', async () => {
    vi.stubEnv('ALLOWED_EMAIL_HOSTS', 'domain1.com, domain2.com');
    const req = mockRequest({ headers: {} });
    const res = await POST(req);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized source' });
  });

  it('returns 403 if reverse DNS is not allowed', async () => {
    vi.stubEnv('ALLOWED_EMAIL_HOSTS', 'domain1.com, domain2.com');
    (dns.reverse as Mock).mockResolvedValue([forbiddenHost]);
    const req = mockRequest({
      headers: { 'x-forwarded-for': allowedIp },
      json: parsedMail,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized source' });
  });

  it('calls processNewEmail and returns 200 for allowed host', async () => {
    (dns.reverse as Mock).mockResolvedValue([allowedHosts[0]]);
    const req = mockRequest({
      headers: { 'x-forwarded-for': allowedIp },
      json: parsedMail,
    });
    const res = await POST(req);
    expect(processNewEmail).toHaveBeenCalledWith(parsedMail);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok' });
  });

  it('skips verification if no allowed hosts are configured', async () => {
    vi.stubEnv('ALLOWED_EMAIL_HOSTS', '');
    const req = mockRequest({
      headers: { 'x-forwarded-for': allowedIp },
      json: parsedMail,
    });
    const res = await POST(req);
    expect(processNewEmail).toHaveBeenCalledWith(parsedMail);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok' });
  });
});
