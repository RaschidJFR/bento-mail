import { describe, it, expect } from 'vitest';
import { User, Bundle } from '@lib/models';

describe('ensureIndexes', () => {
  it('should create the unique email index on User', async () => {
    // await ensureIndexes(mongoose);
    const indexes = await User.collection.indexes();
    const emailIndex = indexes.find((idx) => idx.key.email === 1 && idx.unique);
    expect(emailIndex).toBeDefined();
  });

  it('should create the compound index on Bundle', async () => {
    // await ensureIndexes(mongoose);
    const indexes = await Bundle.collection.indexes();
    const bundleIndex = indexes.find(
      (idx) => idx.key.processingStage === 1 && idx.key.sendOn === 1 && idx.key.user === 1 && idx.key._id === -1
    );
    expect(bundleIndex).toBeDefined();
  });

  // Add similar checks for Newsletter and Article if you have custom indexes
});
