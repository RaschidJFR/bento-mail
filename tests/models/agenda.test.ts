import { describe, expect, it } from 'vitest';

describe('WorkerJob Model', () => {
  it("Model is mapped to Agenda's db and collection", async () => {
    const { default: initWorker } = await import('@services/worker');
    const worker = await initWorker();
    
    const { WorkerJob } = await import('@lib/models/agenda');
    expect(WorkerJob.collection.name).toBe(worker._collection.collectionName);
    expect(WorkerJob.db.name).toBe(worker._mdb.databaseName);
  });
});
