import { z } from 'zod';
import axios from 'axios';
import type { IArticle, INewsletter } from '@lib/models';
import { ParsedMail } from 'mailparser';
import { classifyContent } from '@lib/ai-article-analyzer';
import { fetchHtmlContent } from '@lib/utils';

const API_URL = process.env.APP_URL || 'http://localhost:3000';

type Email = Pick<ParsedMail, 'from' | 'to' | 'subject' | 'text' | 'html'>;

/**
 * Process a new incoming email and create/update relevant resources.
 * @todo Implement atomic transactions
 * @todo Remove dependency on API calls by directly importing services/models
 */
export async function processNewEmail(email: Email) {
  try {
    if (Array.isArray(email.from) && email.from.length > 1) {
      console.warn('[email] Multiple sender addresses found, using the first one.');
    }
    const aliasEmail = Array.isArray(email.to) ? email.to[0].value[0].address : email.to?.value[0].address;
    if (!aliasEmail) throw new Error('Email missing recipient address');
    console.log(`[email] Processing email received for %o: "%o"...`, aliasEmail, email.subject);

    // Zod email validation
    z.string().email().parse(aliasEmail); // Throws if invalid email

    // attempt to create user
    try {
      const response = await axios.post(`${API_URL}/api/user`, {
        email: aliasEmail,
        aliasEmail,
      });
      const { result: user } = response?.data || {};
      console.log(`[email] User created with id %o`, user._id);
    } catch (err) {
      if (!axios.isAxiosError(err) || err.response?.status != 409) {
        throw err;
      }
    }

    let newNewsletter: INewsletter | undefined;
    let newArticle: IArticle | undefined;
    const classification = await classifyContent(email.text || email.html || '');

    // Create article from link
    if (classification.type === 'link') {
      const link = classification.data as string;
      const content = await fetchHtmlContent(link);

      try {
        const response = await axios.post(`${API_URL}/api/article`, {
          content,
          format: 'html',
          url: link,
        });
        const { result } = response?.data || {};
        console.log(`[email] Article created with id %o`, result._id);
        newArticle = result;
      } catch (err) {
        if (!axios.isAxiosError(err) || err.response?.status != 409) {
          throw err;
        }
        const { result } = err.response?.data || {};
        console.log(`[email] Article already exists: %o`, result._id);
        newArticle = result;
      }
    } else if (classification.type === 'article' || classification.type === 'newsletter') {
      // Create newsletter/article from content
      try {
        const response = await axios.post(`${API_URL}/api/newsletter`, {
          content: email.text || email.html,
          format: email.text ? 'text' : 'html',
        });
        const { result } = response?.data || {};
        console.log(`[email] Newsletter created with id %o`, result._id);
        newNewsletter = result;
      } catch (err) {
        if (!axios.isAxiosError(err) || err.response?.status != 409) {
          throw err;
        }
        const { result } = err.response?.data || {};
        console.log(`[email] Newsletter already exists: %o`, result._id);
        newNewsletter = result;
      }
    } else {
      throw new Error(`Unsupported content type: ${classification.type}`);
    }

    // Add object to bundle
    const bundleRes = await axios.post(`${API_URL}/api/bundle`, {
      email: aliasEmail,
      newsletters: newNewsletter ? [newNewsletter._id] : [],
      articles: newArticle ? [newArticle._id] : [],
    });
    const { result: bundle } = (await bundleRes.data) || {};
    console.log(`[email] Added ${classification.type} to bundle %o\n`, bundle._id);
    return bundle;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error(
        `[email] ${error.message} – ${error.response?.data?.error || error.response?.statusText || error.code}`
      );
    }
    console.error(`[email]`, error, '\n');
    return null;
  }
}
