#!/usr/bin/env node

/**
 * Script to create a specific job using Agenda.js.
 * The job requires a running process worker to execute it (see scripts/run-worker.mjs).
 *
 * Usage: node start-job.mjs <jobName>
 */

import 'dotenv/config';

const jobName = process.argv[2];
const args = process.argv.slice(3);

// Parse args in key=value format into an object
const jobArgs = {};
for (const arg of args) {
  const [key, value] = arg.split('=');
  if (key && value !== undefined) {
    jobArgs[key] = value;
  }
}

if (!jobName) {
  console.error('Usage: node start-job.mjs <jobName> [key=value ...]');
  process.exit(1);
}

console.log(`Enqueueing job '${jobName}' with args:`, jobArgs);

let agenda;
try {
  agenda = (await import(`../dist/services/worker.mjs`)).init();
  agenda.database(process.env.MONGODB_URI);
  await new Promise((resolve) => agenda.once('ready', resolve));
} catch (err) {
  console.error(`Failed to load job module 'worker'. Have you built the project?: \`npm run build:jobs\`\n`);
  console.error(err.stack);
  process.exit(1);
}

const job = await agenda.now(jobName, jobArgs);

console.log(`Job '${jobName}' enqueued successfully.`, job.attrs);
await agenda.stop();
await agenda.close();
process.exit(0);
