#!/usr/bin/env node

/**
 * Simple script to forward a sample email (in .eml format) to the test SMTP server.
 * Usage: node scripts/fwd-email.mjs <path-to-eml-file> [from-address]
 */

import 'dotenv/config';
import fs from 'node:fs';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';

const SMTP_PORT = process.env.SMTP_PORT || 1025;
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const MAIL_FROM = process.argv[3] || 'random.source@example.com';
const MAIL_RCPT = 'test.recipient@localhost.me';

const emlPath = process.argv[2];
if (!emlPath) {
  console.error('Usage: send-sample-email.mjs <path-to-eml-file-or-folder>');
  process.exit(1);
}

async function fwdEmail(emlFilePath) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: false,
    tls: { rejectUnauthorized: false },
  });

  const emlContent = fs.readFileSync(emlFilePath, 'utf8');
  const parsed = await simpleParser(emlContent);

  let subject = parsed.subject || '';
  let txtBody = parsed.text || '(no plain text available)';
  let htmlBody = parsed.html || `<pre>${txtBody}</pre>`;

  // Rebuild the message with the new subject
  const mailOptions = {
    from: MAIL_FROM,
    to: MAIL_RCPT,
    subject,
    text: txtBody,
    html: htmlBody,
    attachments: parsed.attachments,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.error(`Error forwarding ${emlFilePath}:`, error);
    }
    console.log(`Email forwarded from %o to %o: %o from file ${emlFilePath}\n`, MAIL_FROM, MAIL_RCPT, subject);
  });
}

const stat = fs.statSync(emlPath);
if (stat.isDirectory()) {
  const files = fs
    .readdirSync(emlPath)
    .filter((f) => f.toLowerCase().endsWith('.eml'))
    .map((f) => `${emlPath}/${f}`);
  if (files.length === 0) {
    console.error('No .eml files found in directory:', emlPath);
    process.exit(1);
  }
  for (const file of files) {
    await fwdEmail(file);
    await new Promise((r) => setTimeout(r, 500)); // slight delay between emails
  }
} else {
  await fwdEmail(emlPath);
}
