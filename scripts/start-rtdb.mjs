#!/usr/bin/env node

import 'dotenv/config';

let startServer;
let server;
try {
  startServer = (await import('../dist/services/RTDB/index.mjs')).setupAndStart;
} catch (err) {
  console.error("Failed to load RTDB module 'RTDB.js'. Have you built the project?: `npm run build`\n");
  console.error(err.stack);
  process.exit(1);
}

console.log('Starting real-time DB server...');
startServer()
  .then((srv) => (server = srv))
  .catch((err) => {
    console.error('RTDB server failed to start:', err);
    process.exit(1);
  });

console.log('Press Ctrl+C to stop the RTDB server\n');

process.on('SIGINT', () => {
  console.log('Stopping RTDB server...');
  server.close();
  process.exit(0);
});
