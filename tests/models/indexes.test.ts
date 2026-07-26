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

  it('should create the unique partial aliasEmail index on User', async () => {
    const indexes = await client.db().collection(COLLECTION_NAMES.users).indexes();
    const aliasEmailIndex = indexes.find((idx) => idx.key.aliasEmail === 1 && idx.unique);
    expect(aliasEmailIndex).toBeDefined();
  });

  it('should create the compound index on Bundle', async () => {
    const indexes = await client.db().collection(COLLECTION_NAMES.bundles).indexes();
    const bundleIndex = indexes.find(
      (idx) =>
        idx.key.processingStage === 1 && idx.key.sendOn === 1 && idx.key.user === 1 && idx.key._id === -1 && idx.unique,
    );
    expect(bundleIndex).toBeDefined();
  });

  it('should create the error index on Newsletter', async () => {
    const indexes = await client.db().collection(COLLECTION_NAMES.newsletters).indexes();
    const errorIndex = indexes.find((idx) => idx.key.error === 1);
    expect(errorIndex).toBeDefined();
  });

  it('should create the date index on Newsletter', async () => {
    const indexes = await client.db().collection(COLLECTION_NAMES.newsletters).indexes();
    const dateIndex = indexes.find((idx) => idx.key.date === -1);
    expect(dateIndex).toBeDefined();
  });

  it('should create the lastError index on Article', async () => {
    const indexes = await client.db().collection(COLLECTION_NAMES.articles).indexes();
    const lastErrorIndex = indexes.find((idx) => idx.key.lastError === 1);
    expect(lastErrorIndex).toBeDefined();
  });

  it('should create the compound article index', async () => {
    const indexes = await client.db().collection(COLLECTION_NAMES.articles).indexes();
    const articleIndex = indexes.find((idx) => idx.key.sourceName === 1 && idx.key.date === -1 && idx.key._id === 1);
    expect(articleIndex).toBeDefined();
  });

  it('should create the reaction index', async () => {
    const indexes = await client.db().collection(COLLECTION_NAMES.reactions).indexes();
    const reactionIndex = indexes.find((idx) => idx.key.user === 1 && idx.key.article === 1 && idx.unique);
    expect(reactionIndex).toBeDefined();
  });

  it('should create the compound index on Task', async () => {
    const indexes = await client.db().collection(COLLECTION_NAMES.tasks).indexes();
    const taskIndex = indexes.find((idx) => idx.key.name === 1 && idx.key.lockedAt === 1);
    expect(taskIndex).toBeDefined();
  });
});
