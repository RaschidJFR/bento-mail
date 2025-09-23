import axios from 'axios';
import MailDev from 'maildev';
import { z } from 'zod';

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

export async function processNewEmail(email: Mail) {
  try {
    const userEmail = email.envelope?.from?.address;
    console.log(`Processing email received from ${userEmail}: "${email.subject}"...`);

    // Zod email validation
    z.string().email().parse(userEmail); // Throws if invalid email

    // attempt to create user
    try {
      const response = await axios.post(`${process.env.APP_URL}/api/user`, {
        email: userEmail,
      });
      const { result: user } = response?.data || {};
      console.log(`User created with id '${user._id}'`);
    } catch (err) {
      if (!axios.isAxiosError(err) || err.response?.status != 409) {
        throw err;
      }
    }

    // Create newsletter
    let objectType = '';
    let object = null;
    try {
      const response = await axios.post(`${process.env.APP_URL}/api/content`, {
        content: email.text || email.html,
        format: email.text ? 'text' : 'html',
      });
      const { result, type } = response?.data || {};
      console.log(`${type} created with id '${result._id}'`);
      objectType = type;
      object = result;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status == 409) {
        const { result, type } = err.response?.data || {};
        console.log(`${type} already exists. id: '${result._id}'`);
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
    console.log(`Bundle '${bundle._id}' updated with ${objectType} '${object?._id}'\n`);
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error(
        `[email] ${error.message} – ${error.response?.data?.error || error.response?.statusText || error.code}`
      );
    }
    console.error(error.stack, '\n');
  }
}

export default maildev;
