#!/usr/bin/env node
import MailDev from 'maildev';
import 'dotenv/config';
import { simpleParser } from 'mailparser';

const server = new MailDev({});
try {
  const { processNewEmail } = await import('../dist/services/email/index.mjs');
  const { saveEmailSample, fetchRawEmailFromMaildev } = await import('../dist/services/email/utils.mjs');
  server.on('new', async (email) => {
    if (process.env.NODE_ENV === 'development') {
      saveEmailSample(email);
    }
    const rawEmail = await fetchRawEmailFromMaildev(email.id);
    if (!rawEmail) return null;
    const parsed = await simpleParser(rawEmail);
    return processNewEmail(parsed);
  });
} catch (err) {
  console.error(
    "Failed to load mail server module 'email.mjs'. Have you built the project?: `npm run build:services`\n"
  );
  console.error(err.stack);
  process.exit(1);
}

console.log('Starting mail server...');

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

server.on('ready', () => {
  console.log('Press Ctrl+C to stop the server\n');
});

process.on('SIGINT', () => {
  console.log('Stopping mail server...');
  server.close(() => {
    console.log('Mail server stopped.');
    process.exit(0);
  });
});

server.listen({
  smtp: process.env.SMTP_PORT || 1025,
});
