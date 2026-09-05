// Local dev helper: forges a Better Auth session for an existing user and
// prints a browser-console snippet that sets the signed cookie.
//
// Usage:
//   node scripts/sign-session-cookie.mjs <email>
//
// Env (loaded from .env if present):
//   MONGODB_URI            required
//   BETTER_AUTH_SECRET     required
//   APP_URL                optional (defaults to http://localhost:3000)

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import ConnectionString from 'mongodb-connection-string-url';

const email = process.argv[2];
const secret = process.env.BETTER_AUTH_SECRET;
const mongoUri = process.env.MONGODB_URI;
const appUrl = process.env.APP_URL || 'http://localhost:3000';

if (!email || !secret || !mongoUri) {
  console.error('Usage: node scripts/sign-session-cookie.mjs <email>');
  console.error('Requires BETTER_AUTH_SECRET and MONGODB_URI in env / .env.');
  process.exit(1);
}

const dbName = new ConnectionString(mongoUri).pathname?.replace(/^\//, '') || '';
if (!dbName) {
  console.error('Could not extract database name from MONGODB_URI.');
  process.exit(1);
}

const client = new MongoClient(mongoUri);
await client.connect();
try {
  const db = client.db(dbName);
  const user = await db
    .collection('users')
    .findOne({ $or: [{ email }, { aliasEmail: email }] });
  if (!user) {
    console.error(
      `No user found with email or aliasEmail "${email}" in ${dbName}.users.`,
    );
    process.exit(1);
  }

  const token =
    'localdev_' +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db.collection('session').insertOne({
    token,
    userId: user._id,
    expiresAt,
    createdAt: now,
    updatedAt: now,
    ipAddress: '127.0.0.1',
    userAgent: 'local-dev-forgery',
  });

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(token),
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  const cookieValue = encodeURIComponent(`${token}.${signature}`);

  // Clear any prior Better Auth cookies (both plain and __Secure- prefixed)
  // before setting the forged session, then reload.
  const cookieNames = [
    'better-auth.session_token',
    'better-auth.session_data',
    'better-auth.account_data',
    'better-auth.dont_remember',
    '__Secure-better-auth.session_token',
    '__Secure-better-auth.session_data',
    '__Secure-better-auth.account_data',
    '__Secure-better-auth.dont_remember',
  ];
  const clearStmts = cookieNames
    .map((n) => `document.cookie=${JSON.stringify(`${n}=; path=/; max-age=0`)};`)
    .join(' ');
  const setStmt =
    `document.cookie = "better-auth.session_token=${cookieValue}; ` +
    `path=/; max-age=2592000; SameSite=Lax";`;
  const snippet = `${clearStmts} ${setStmt} location.reload();`;

  console.log(`Forged session for ${user.email} (${user._id.toString()}).`);
  console.log(`Expires: ${expiresAt.toISOString()}`);
  console.log('');
  console.log(`Open ${appUrl} and paste this into the DevTools console:`);
  console.log('');
  console.log(snippet);
} finally {
  await client.close();
}
