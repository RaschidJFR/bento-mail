import axios from 'axios';
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

maildev.on('new', async (email) => {
  try {
    const userEmail = email.envelope?.from?.address;
    console.log(`Processing email received from ${userEmail}: "${email.subject}"...`);

    // Zod email validation
    const emailSchema = z.string().email();
    emailSchema.parse(userEmail); // Throws if invalid

    const response = await axios.post(`${process.env.APP_URL}/api/extract/newsletter`, {
      content: email.text || email.html,
      userEmail,
      format: email.text ? 'text' : 'html',
    });
    console.log('Email processed: ', JSON.stringify(response.data?.data, null, 2));
  } catch (error) {
    console.error(error.message);
    console.error(error.stack);
  }
});
