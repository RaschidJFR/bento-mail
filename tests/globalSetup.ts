import mongoose from 'mongoose';
import 'dotenv/config';

export async function setup() {
  const TEST_DATABASE_NAME = 'Bento-test';
  process.env.DATABASE_NAME = TEST_DATABASE_NAME;

  // Clear API keys to prevent accidental usage during tests
  process.env.OPENAI_API_KEY = 'mocked-key';

  const connectionString = process.env.MONGODB_URI || '';
  console.log(`Connecting to test database...`);
  await mongoose.connect(connectionString, { dbName: TEST_DATABASE_NAME });
  console.log('Connected to test database.');
}

export async function teardown() {
  console.log('Tearing down test database...');
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  console.log('Database connection closed.');
}
