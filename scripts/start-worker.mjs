#!/usr/bin/env node

/**
 * Simple script to start the background worker that processes jobs from the queue.
 *
 * Usage: node scripts/start-worker.mjs [collectionName]
 * If collectionName is provided, the worker will process jobs from that specific collection.
 *
 * Environment variables:
 *   - MONGODB_URI: MongoDB connection string (required)
 *   - WORKER_PROCESSING_INTERVAL: How often to check for new jobs (default: '1 hour')
 */

import 'dotenv/config';
let worker;
const collectionName = process.argv[2];
const interval = process.env.WORKER_PROCESSING_INTERVAL || '1 hour';

try {
  const instantiate = (await import('../dist/services/worker.mjs')).default;
  worker = instantiate()
    .database(process.env.MONGODB_URI, collectionName || '')
    .processEvery(interval);
  await new Promise((resolve) => worker.once('ready', resolve));
} catch (err) {
  console.error("Failed to load worker module 'worker.mjs'. Have you built the project?: `npm run build:services`\n");
  console.error(err.stack);
  process.exit(1);
}

console.log('Starting worker...');
worker.start();
console.log(`Worker started, polling jobs at intervals of ${interval}. \nPress Ctrl+C to stop.\n`);

// Gracefully handle shutdown signals
const shutdown = async () => {
  console.log('\nShutting down worker...\n');
  await worker.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
