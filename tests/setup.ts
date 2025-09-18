import mongoose from 'mongoose';
import { afterEach } from 'vitest';
import 'dotenv/config';

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
