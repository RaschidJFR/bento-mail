#!/usr/bin/env node

/**
 * Simple script to forward a sample email (in .eml format) to the test SMTP server.
 * Usage: node scripts/fwd-email.mjs <path-to-eml-file>
 */

import 'dotenv/config';
import fs from 'node:fs';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';

const SMTP_PORT = process.env.SMTP_PORT || 1025;
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const MAIL_FROM = 'random-user@example.com';
const MAIL_RCPT = 'test-server@localhost';

const emlPath = process.argv[2];
if (!emlPath) {
  console.error('Usage: send-sample-email.mjs <path-to-eml-file>');
  process.exit(1);
}

async function fwdEmail() {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: false,
    tls: { rejectUnauthorized: false },
  });

  const emlContent = fs.readFileSync(emlPath, 'utf8');
  const parsed = await simpleParser(emlContent);

  // Prepend 'Fwd: ' to subject if not already present
  let newSubject = parsed.subject || '';
  if (!/^fwd:/i.test(newSubject)) {
    newSubject = 'Fwd: ' + newSubject;
  }

  let txtBody = parsed.text || '(no plain text available)';
  let htmlBody = parsed.html || `<pre>${txtBody}</pre>`;

  txtBody = `---------- Forwarded message ---------
  From: ${parsed.from?.text}
  Date: ${parsed.date}
  Subject: ${parsed.subject}
  To: ${parsed.to?.text}
  
  ${txtBody}`;

  htmlBody = `<p>---------- Forwarded message ---------</p>
  <p><strong>From:</strong> ${parsed.from?.html}</p>
  <p><strong>Date:</strong> ${parsed.date}</p>
  <p><strong>Subject:</strong> ${parsed.subject}</p>
  <p><strong>To:</strong> ${parsed.to?.html}</p>
  <br/>
  ${htmlBody}`;

  // Rebuild the message with the new subject
  const mailOptions = {
    from: MAIL_FROM,
    to: MAIL_RCPT,
    subject: newSubject,
    text: txtBody,
    html: htmlBody,
    attachments: parsed.attachments,
  };

  await transporter.sendMail(mailOptions);
  console.log(`Email forwarded to '${MAIL_RCPT}': "${newSubject}"`);
}

await fwdEmail();
