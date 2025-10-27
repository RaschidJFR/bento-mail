import { z } from 'zod';
import axios from 'axios';
import type { INewsletter } from '@lib/models';
import { ParsedMail } from 'mailparser';

const API_URL = process.env.APP_URL || 'http://localhost:3000';

type Email = Pick<ParsedMail, 'from' | 'to' | 'subject' | 'text' | 'html'>;

/**
 *  Process a new incoming email and create/update relevant resources.
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

    // Create newsletter
    let object: INewsletter;
    try {
      const response = await axios.post(`${API_URL}/api/newsletter`, {
        content: email.text || email.html,
        format: email.text ? 'text' : 'html',
      });
      const { result } = response?.data || {};
      console.log(`[email] Newsletter created with id %o`, result._id);
      object = result;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status == 409) {
        const { result, type } = err.response?.data || {};
        console.log(`[email] ${type} already exists: %o`, result._id);
        object = result;
      } else {
        throw err;
      }
    }

    // Add object to bundle
    const bundleRes = await axios.post(`${API_URL}/api/bundle`, {
      email: aliasEmail,
      newsletters: [object._id],
      articles: [],
    });
    const { result: bundle } = (await bundleRes.data) || {};
    console.log(`[email] Bundle %o updated with newsletter %o\n`, bundle._id, object?._id);
    return object;
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
