import axios from 'axios';
import MailDev from 'maildev';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

interface Mail {
  id?: string;
  envelope?: {
    from?: {
      address: string;
      name?: string;
    };
  };
  subject?: string;
  text?: string;
  html?: string;
}

const maildev = new MailDev({});
maildev.on('new', processNewEmail);

function sanitizeFilename(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 100);
}

async function fetchRawEmailFromMaildev(id: string): Promise<string | null> {
  const url = `http://127.0.0.1:1080/email/${id}/source`;
  try {
    const response = await axios.get(url, { responseType: 'text' });
    if (response.status === 200 && typeof response.data === 'string') {
      return response.data;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveEmailSample(email: Mail) {
  const subject = email.subject ? sanitizeFilename(email.subject) : 'untitled';
  let filePath: string;
  let raw = null;
  if (email.id) {
    raw = await fetchRawEmailFromMaildev(email.id);
  }

  const dir = path.resolve(process.cwd(), 'samples/email');
  await fs.promises.mkdir(dir, { recursive: true });
  if (raw) {
    filePath = path.join(dir, `${subject}.eml`);
    await fs.promises.writeFile(filePath, raw, 'utf8');
  } else {
    filePath = path.join(dir, `${subject}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(email, null, 2), 'utf8');
  }
}

export async function processNewEmail(email: Mail) {
  try {
    if (process.env.NODE_ENV != 'production') await saveEmailSample(email);
    
    const userEmail = email.envelope?.from?.address;
    console.log(`Processing email received from %o: "${email.subject}"...`, userEmail);

    // Zod email validation
    z.string().email().parse(userEmail); // Throws if invalid email

    // attempt to create user
    try {
      const response = await axios.post(`${process.env.APP_URL}/api/user`, {
        email: userEmail,
      });
      const { result: user } = response?.data || {};
      console.log(`User created with id %o`, user._id);
    } catch (err) {
      if (!axios.isAxiosError(err) || err.response?.status != 409) {
        throw err;
      }
    }

    // Create newsletter
    let objectType = '';
    let object = null;
    try {
      const response = await axios.post(`${process.env.APP_URL}/api/newsletter`, {
        content: email.text || email.html,
        format: email.text ? 'text' : 'html',
      });
      const { result, type } = response?.data || {};
      console.log(`${type} created with id %o`, result._id);
      objectType = type;
      object = result;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status == 409) {
        const { result, type } = err.response?.data || {};
        console.log(`${type} already exists: %o`, result._id);
        objectType = type;
        object = result;
      } else {
        throw err;
      }
    }

    // Add object to bundle
    const bundleRes = await axios.post(`${process.env.APP_URL}/api/bundle`, {
      email: userEmail,
      newsletters: objectType === 'newsletter' ? [object._id] : [],
      articles: objectType === 'article' ? [object._id] : [],
    });
    const { result: bundle } = (await bundleRes.data) || {};
    console.log(`Bundle %o updated with ${objectType} %o\n`, bundle._id, object?._id);
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error(
        `[email] ${error.message} – ${error.response?.data?.error || error.response?.statusText || error.code}`
      );
    }
    console.error(error, '\n');
  }
}

export default maildev;
