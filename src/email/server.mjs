import axios, { AxiosError } from 'axios';
import MailDev from 'maildev';
import 'dotenv/config';
import { z } from 'zod';

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const maildev = new MailDev();

maildev.listen({
  smtp: process.env.SMTP_PORT || 1025,
});

maildev.on('new', processNewEmail);

export async function processNewEmail(email) {
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
      if (!(err instanceof AxiosError) || err?.code != 409) {
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
      console.log(`${type} created with id '${result._id}'`);
      objectType = type;
      object = result;
    } catch (err) {
      if (err instanceof AxiosError && err.code == 409) {
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
    console.log(`${objectType} '${object?._id}' added to bundle '${bundle._id}' for '${userEmail}'`);
  } catch (error) {
    console.error(error.message);
    console.error(error.stack);
  }
}
