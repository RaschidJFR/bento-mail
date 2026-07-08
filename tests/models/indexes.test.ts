import { describe, it, expect, afterAll } from 'vitest';
import { MongoClient } from 'mongodb';
import { COLLECTION_NAMES } from '@lib/prisma/contract';

const client = new MongoClient(process.env.MONGODB_URI!);

afterAll(async () => {
  await client.close();
});

describe('ensureIndexes', () => {
  it('should create the unique email index on User', async () => {
    const indexes = await client.db().collection(COLLECTION_NAMES.users).indexes();
    const emailIndex = indexes.find((idx) => idx.key.email === 1 && idx.unique);
    expect(emailIndex).toBeDefined();
  });

  it('should create the compound index on Bundle', async () => {
    const indexes = await client.db().collection(COLLECTION_NAMES.bundles).indexes();
    const bundleIndex = indexes.find(
      (idx) => idx.key.processingStage === 1 && idx.key.sendOn === 1 && idx.key.user === 1 && idx.key._id === -1
    );
    expect(bundleIndex).toBeDefined();
  });

  // Add similar checks for Newsletter and Article if you have custom indexes
});
