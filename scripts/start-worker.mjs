#!/usr/bin/env node

/**
 * Simple script to start the background worker that processes jobs from the queue.
 *
 * Usage: node scripts/start-worker.js [collectionName]
 * If collectionName is provided, the worker will process jobs from that specific collection.
 *
 * Environment variables:
 *   - WORKER_PROCESSING_INTERVAL: How often to check for new jobs (default: '30 seconds')
 */

import 'dotenv/config';
let worker;
let initWorker;
try {
  initWorker = (await import('../dist/services/worker/index.js')).default;
} catch (err) {
  console.error("Failed to load worker module 'worker.js'. Have you built the project?: `npm run build:services`\n");
  console.error(err.stack);
  process.exit(1);
}

worker = await initWorker();
worker.processEvery(process.env.WORKER_PROCESSING_INTERVAL || '30 seconds');
console.log('Starting worker...');
worker.start().then(() => {
  const collectionName = worker.db?.collection?.collectionName;
  console.log(
    `Worker started, polling jobs at intervals of ${worker.attrs.processEvery / 1000} seconds from ${collectionName}. \nPress Ctrl+C to stop.\n`
  );
});

// Gracefully handle shutdown signals
const shutdown = async () => {
  console.log('\nShutting down worker...\n');
  await worker.stop();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
