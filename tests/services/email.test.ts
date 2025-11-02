import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { processNewEmail } from '@services/email';
import { AxiosError } from 'axios';
import { ResponseData as PostNewsletterResponse } from '@app/api/newsletter/route';
import { ResponseData as PostBundleResponse } from '@app/api/bundle/post';
import { type IBundle } from '@lib/models';

function getMockEmailData({ to = 'user@example.com', subject = 'Test Subject', text = 'Test Content' }) {
  return {
    to: [{ value: [{ address: to }] }],
    subject,
    text,
    html: '',
  };
}

describe('Email processing', () => {
  beforeEach(async () => {
    const aiAnalyzer = await import('@lib/ai-article-analyzer');
    vi.spyOn(aiAnalyzer, 'classifyContent').mockResolvedValueOnce({
      type: 'newsletter',
      reason: '',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

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

  it('calls article API endpoint if content is link', async () => {
    const user = { email: 'user@example.com', _id: 'userid' };
    const article = { _id: 'articleid', content: 'Article parsed content', url: 'https://example.com/test-article' };
    const bundle = { _id: 'bundleid', articles: [article._id], user: user } as unknown as IBundle;

    const aiAnalyzer = await import('@lib/ai-article-analyzer');
    vi.spyOn(aiAnalyzer, 'classifyContent').mockResolvedValue({
      type: 'link',
      reason: '',
      data: article.url,
    });

    const utils = await import('@lib/utils');
    vi.spyOn(utils, 'fetchHtmlContent').mockResolvedValue('</p>Just any HTML content</p>');

    const { default: axios } = await import('axios');
    vi.spyOn(axios, 'post')
      // Create user
      .mockImplementationOnce(async () => {
        return { status: 201, data: { result: { id: user._id } } } as any;
      })
      // Create article
      .mockImplementationOnce(async () => {
        return { data: { result: article } };
      })
      // Create bundle
      .mockImplementationOnce(async () => {
        return { data: { result: bundle } as PostBundleResponse };
      });

    const result = await processNewEmail(
      getMockEmailData({ to: user.email, text: 'Check out this article: https://example.com/test-article' }) as any
    );

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/user'), {
      email: user.email,
      aliasEmail: user.email,
    });
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/article'), {
      content: '</p>Just any HTML content</p>',
      format: 'html',
      url: article.url,
    });

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/bundle'), {
      email: user.email,
      newsletters: [],
      articles: [article._id],
    });

    expect(result?._id).toBe(bundle._id);
  });

  it('calls newsletter API endpoint if content is article', async () => {
    const user = { email: 'user@example.com', _id: 'userid' };
    const newsletter = { _id: 'newsletterId', content: 'Newsletter content', articles: ['articleId'] };
    const bundle = { _id: 'bundleid', newsletters: [newsletter._id], user: user } as unknown as IBundle;

    const aiAnalyzer = await import('@lib/ai-article-analyzer');
    vi.spyOn(aiAnalyzer, 'classifyContent').mockResolvedValue({
      type: 'article',
      reason: '',
    });

    const { default: axios } = await import('axios');
    vi.spyOn(axios, 'post')
      // Create user
      .mockImplementationOnce(async () => {
        return { status: 201, data: { result: { id: user._id } } } as any;
      })
      // Create article
      .mockImplementationOnce(async () => {
        return { data: { result: newsletter } };
      })
      // Create bundle
      .mockImplementationOnce(async () => {
        return { data: { result: bundle } as PostBundleResponse };
      });

    const result = await processNewEmail(getMockEmailData({ to: user.email, text: 'Newsletter content' }) as any);

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/user'), {
      email: user.email,
      aliasEmail: user.email,
    });
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/newsletter'), {
      content: 'Newsletter content',
      format: 'text',
    });

    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/bundle'), {
      email: user.email,
      articles: [],
      newsletters: [newsletter._id],
    });

    expect(result?._id).toBe(bundle._id);
  });
});
