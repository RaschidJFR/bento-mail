import { describe, it, expect, vi } from 'vitest';
import { processNewEmail } from '@services/email';
import { AxiosError } from 'axios';

function getMockEmailData({ from = 'user@example.com', subject = 'Test Subject', text = 'Test Content' }) {
  return {
    envelope: {
      from: {
        address: from,
      },
    },
    subject,
    text,
  };
}

describe('Email processing', () => {
  it('ignore emails without from address', async () => {});

  it('creates newsletter and adds to bundle', async () => {
    const user = { email: 'user@example.com', _id: 'userid' };
    const newsletter = { _id: 'newsletterid' };
    const bundle = { _id: 'bundleid', newsletters: ['newsletterid'], user };

    const { default: axios } = await import('axios');
    vi.spyOn(axios, 'post')
      // User already exists
      .mockImplementationOnce(async (url, data) => {
        throw new AxiosError('', '', undefined, null, { status: 409, data: { result: { id: user._id } } } as any);
      })
      // Create newsletter
      .mockImplementationOnce(async (url, data) => {
        return { data: { result: newsletter, type: 'newsletter' } };
      })
      // Create bundle
      .mockImplementationOnce(async (url, data) => {
        return { data: { result: bundle } };
      });

    await processNewEmail(getMockEmailData({ from: user.email, text: 'Test newsletter content' }));
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/user'), {
      email: user.email,
    });
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/newsletter'), {
      content: 'Test newsletter content',
      format: 'text',
    });
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/bundle'), {
      email: user.email,
      newsletters: [newsletter._id],
      articles: [],
    });
  });

  it('finds existing newsletter and adds to bundle', async () => {
    const user = { email: 'user@example.com', _id: 'userid' };
    const newsletter = { _id: 'newsletterid' };
    const bundle = { _id: 'bundleid', newsletters: [newsletter._id], user };

    const { default: axios } = await import('axios');
    vi.spyOn(axios, 'post')
      // Attempt to create user
      .mockImplementationOnce(async () => {
        throw new AxiosError('', '', undefined, null, { status: 409, data: { result: { id: user._id } } } as any);
      })
      // Attempt to create newsletter, but it already exists
      .mockImplementationOnce(async () => {
        throw new AxiosError('', '', undefined, null, {
          status: 409,
          data: { result: { _id: newsletter._id }, type: 'newsletter' },
        } as any);
      })
      // Create bundle
      .mockImplementationOnce(async () => {
        return { data: { result: bundle } };
      });

    await processNewEmail(getMockEmailData({ from: user.email, text: 'Test newsletter content' }));
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/newsletter'), {
      content: 'Test newsletter content',
      format: 'text',
    });
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/bundle'), {
      email: user.email,
      newsletters: [newsletter._id],
      articles: [],
    });
  });

  it('creates user if not found', async () => {
    const user = { email: 'newuser@example.com', _id: 'userid' };
    const newsletter = { _id: 'newsletterid' };
    const bundle = { _id: 'bundleid', newsletters: [newsletter._id], user: user };

    const { default: axios } = await import('axios');
    vi.spyOn(axios, 'post')
      // Create user
      .mockImplementationOnce(async () => {
        throw new AxiosError('', '', undefined, null, { status: 409, data: { result: { id: user._id } } } as any);
      })
      // Create newsletter
      .mockImplementationOnce(async () => {
        return { data: { result: newsletter, type: 'newsletter' } };
      })
      .mockImplementationOnce(async () => {
        return { data: { result: bundle } };
      });

    await processNewEmail(getMockEmailData({ from: user.email, text: 'Test newsletter content' }));

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/user'), {
      email: user.email,
    });
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/newsletter'), {
      content: 'Test newsletter content',
      format: 'text',
    });
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/bundle'), {
      email: user.email,
      newsletters: [newsletter._id],
      articles: [],
    });
  });
});
