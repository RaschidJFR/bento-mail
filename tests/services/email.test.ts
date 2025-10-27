import { describe, it, expect, vi } from 'vitest';
import { processNewEmail } from '@services/email';
import { AxiosError } from 'axios';
import { ResponseData as PostNewsletterResponse } from '@app/api/newsletter/route';
import { ResponseData as PostBundleResponse } from '@app/api/bundle/post';
import { Newsletter, type IBundle } from '@lib/models';

function getMockEmailData({ to = 'user@example.com', subject = 'Test Subject', text = 'Test Content' }) {
  return {
    to: [{ value: [{ address: to }] }],
    subject,
    text,
    html: '',
  };
}

describe('Email processing', () => {
  it('calls API (user exists)', async () => {
    const user = { email: 'user@example.com', _id: 'userid' };
    const newsletter = { _id: 'newsletterid' };
    const bundle = { _id: 'bundleid', newsletters: ['newsletterid'], user } as unknown as IBundle;

    const { default: axios } = await import('axios');
    vi.spyOn(axios, 'post')
      // User already exists
      .mockImplementationOnce(async (url, data) => {
        throw new AxiosError('', '', undefined, null, { status: 409, data: { result: { id: user._id } } } as any);
      })
      // Create newsletter
      .mockImplementationOnce(async (url, data) => {
        return { data: { result: newsletter } as PostNewsletterResponse };
      })
      // Create bundle
      .mockImplementationOnce(async (url, data) => {
        return { data: { result: bundle } as PostBundleResponse };
      });

    await processNewEmail(getMockEmailData({ to: user.email, text: 'Test newsletter content' }) as any);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/user'), {
      email: user.email,
      aliasEmail: user.email,
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

  it('calls API (newsletter exists)', async () => {
    const user = { email: 'user@example.com', _id: 'userid' };
    const newsletter = { _id: 'newsletterid' };
    const bundle = { _id: 'bundleid', newsletters: [newsletter._id], user } as unknown as IBundle;

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
          data: { result: { _id: newsletter._id } } as PostNewsletterResponse,
        } as any);
      })
      // Create bundle
      .mockImplementationOnce(async () => {
        return { data: { result: bundle } as PostBundleResponse };
      });

    await processNewEmail(getMockEmailData({ to: user.email, text: 'Test newsletter content' }) as any);
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

  it('calls API (new user)', async () => {
    const user = { email: 'newuser@example.com', _id: 'userid' };
    const newsletter = { _id: 'newsletterid' };
    const bundle = { _id: 'bundleid', newsletters: [newsletter._id], user: user } as unknown as IBundle;

    const { default: axios } = await import('axios');
    vi.spyOn(axios, 'post')
      // Create user
      .mockImplementationOnce(async () => {
        return { status: 201, data: { result: { id: user._id } } } as any;
      })
      // Create newsletter
      .mockImplementationOnce(async () => {
        return { data: { result: newsletter } as PostNewsletterResponse };
      })
      .mockImplementationOnce(async () => {
        return { data: { result: bundle } as PostBundleResponse };
      });

    await processNewEmail(getMockEmailData({ to: user.email, text: 'Test newsletter content' }) as any);

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/user'), {
      email: user.email,
      aliasEmail: user.email,
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
