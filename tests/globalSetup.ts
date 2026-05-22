import mongoose from 'mongoose';
import 'dotenv/config';
import { MongoCluster } from 'mongodb-runner';
import { ConnectionString } from 'mongodb-connection-string-url';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const cluster = await spinUpMongoCluster();

export async function setup() {
  // Clear API keys to prevent accidental usage during tests
  process.env.OPENAI_API_KEY = '';

  // Set test databases
  const cs = new ConnectionString(cluster.connectionString);
  cs.pathname = '/_test';
  cs.hosts = [cs.hosts[0]]; // Prisma does not support multiple hosts in the connection string. See https://github.com/prisma/prisma-next/issues/578
  process.env.MONGODB_URI = cs.toString();
  process.env.AGENDA_DB_NAME = 'agenda_test';

  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function teardown() {
  console.log('Tearing down test database...');
  await mongoose.connection.useDb('_test').dropDatabase();
  await mongoose.connection.useDb('agenda_test').dropDatabase();
  await mongoose.connection.close();
  await cluster.close();
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
