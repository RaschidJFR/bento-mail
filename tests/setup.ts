import mongoose from 'mongoose';
import { afterEach, vi } from 'vitest';

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
