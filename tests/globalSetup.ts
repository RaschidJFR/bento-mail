import 'dotenv/config';
import { MongoCluster } from 'mongodb-runner';
import { ConnectionString } from 'mongodb-connection-string-url';
import { spawnSync } from 'node:child_process';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { MongoClient } from 'mongodb';

let cluster: MongoCluster | null = null;

export async function setup() {
  // Clear API keys to prevent accidental usage during tests
  process.env.OPENAI_API_KEY = '';

  if (process.env.TEST_MONGODB_URI) {
    console.log('Using test database %o', process.env.TEST_MONGODB_URI);
    process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
  } else {
    cluster = await spinUpMongoCluster();
  }

  // Set test databases
  const cs = new ConnectionString(cluster?.connectionString || process.env.MONGODB_URI!);
  cs.pathname = '/_test';
  process.env.MONGODB_URI = cs.toString();
  process.env.AGENDA_DB_NAME = 'agenda_test';

  applyContractToTestDb(process.env.MONGODB_URI!);
}

function applyContractToTestDb(url: string) {
  const args = ['prisma@next', 'db', 'init', '--db', url, '--yes'];
  const result = spawnSync('npx', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `\`prisma ${args.join(' ')}\` failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`,
    );
  }
}

export async function teardown() {
  console.log('Tearing down test database...');
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.db('_test').dropDatabase();
  await client.db('agenda_test').dropDatabase();
  await cluster?.close();
  console.log('Database connection closed.');
}

async function spinUpMongoCluster() {
  console.log('Starting MongoDB test cluster...');

  const tmpDir = path.join(os.tmpdir(), `runner-tests-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const cluster = await MongoCluster.start({
    topology: 'replset',
    tmpDir,
    version: '8.x',
  });

  console.log(`MongoDB test cluster started at ${cluster.connectionString}`);
  return cluster;
}
