import mongoose from 'mongoose';
import 'dotenv/config';

export async function setup() {
  // Clear API keys to prevent accidental usage during tests
  process.env.OPENAI_API_KEY = '';

  // Use a separate test database (used by @models/index.ts)
  process.env.DATABASE_NAME = '_test';
  process.env.AGENDA_COLLECTION = 'agenda_test';

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not set in environment variables');
  }
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.DATABASE_NAME });
}

export async function teardown() {
  console.log('Tearing down test database...');
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  console.log('Database connection closed.');
}
