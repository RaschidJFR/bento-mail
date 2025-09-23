#!/usr/bin/env node
import 'dotenv/config';

let server;
try {
  server = await import('../dist/services/email.mjs');
} catch (err) {
  console.error("Failed to load mail server module 'email.mjs'. Have you built the project?: `npm run build:services`\n");
  console.error(err.stack);
  process.exit(1);
}

console.log('Starting mail server...');

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

server.default.listen({
  smtp: process.env.SMTP_PORT || 1025,
});
