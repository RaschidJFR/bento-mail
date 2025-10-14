import { JobNames } from '@services/worker';
import { Bundle, Newsletter } from '@lib/models';
import Agenda from 'agenda';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

describe('Worker', () => {
  let agenda: Agenda, worker: Agenda;

  beforeAll(async () => {
    const instantiate = (await import('@services/worker')).default;

    // Create an Agenda instance for scheduling jobs
    agenda = await instantiate();

    // Create a worker instance to process jobs
    worker = await instantiate();
    worker.processEvery('.1 seconds');
    await worker.start();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await agenda._mdb.collection(agenda._collection.collectionName).deleteMany({});
  });

  afterAll(async () => {
    console.log('Agenda stop. Cleaning up test database...');
    await worker.stop();
    await worker.close();
    await agenda.close();
    console.log('Agenda database cleaned up.');
  });

  it('Agenda is using the designated db', async () => {
    vi.stubEnv('AGENDA_DB_NAME', 'pechuga');
    const { default: initWorker } = await import('@services/worker')
    const w = await initWorker();
    expect(w._collection.dbName).toBe('pechuga');
    expect(w._collection.collectionName).toBe('agendaJobs');

    await w._mdb.dropDatabase();
    await w.close();
  });

  it('Job.save() is bypassed when no MONGODB_URI is unset in non-production environment', async () => {
    vi.stubEnv('MONGODB_URI', '');
    vi.stubEnv('NODE_ENV', 'notproduction');

    let instantiate = (await import('@services/worker')).default;
    let localAgenda = await instantiate();
    await expect(localAgenda.create('someJob', {}).save()).resolves.not.toThrow();
  });

  it('Job.save() should not be bypassed in production', async () => {
    vi.stubEnv('MONGODB_URI', '');
    vi.stubEnv('NODE_ENV', 'production');
    const Job = (await import('agenda/dist/job')).Job;
    const originalSave = vi.spyOn(Job.prototype, 'save');

    let instantiate = (await import('@services/worker')).default;
    let localAgenda = await instantiate();

    // expect error from missing MONGODB_URI
    await expect(localAgenda.create('someJob', {}).save()).rejects.toThrow();
  });

  describe('Bundle.process', () => {
    let processContent: Mock;

    beforeEach(() => {
      // Mock the Bundle class that will be called by the job
      processContent = vi.fn().mockResolvedValue(0);
      vi.spyOn(Bundle, 'findById').mockResolvedValue({
        processContent,
        processingStage: Bundle.ProcessingStages.NOT_STARTED,
      });
    });

    it('process one bundle', async () => {
      await agenda.now(JobNames.Bundle.process, { id: 'bundle123' });

      // Wait for the job to complete
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(processContent).toHaveBeenCalled();
    });

    it('fail if bundle has already been processed', async () => {
      const id = 'bundleId';

      function mockAndReset(stage: Bundle.ProcessingStages) {
        processContent.mockClear();
        vi.spyOn(Bundle, 'findById').mockReturnValue({
          processingStage: stage,
          processContent,
        });
      }

      // Should not process
      mockAndReset(Bundle.ProcessingStages.SENT);
      await agenda.now(JobNames.Bundle.process, { id });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(processContent).not.toHaveBeenCalled();

      // Should not process
      mockAndReset(Bundle.ProcessingStages.CONTENT_PROCESSED);
      await agenda.now(JobNames.Bundle.process, { id });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(processContent).not.toHaveBeenCalled();

      // Should proceed with processing
      mockAndReset(Bundle.ProcessingStages.COMPLETED_WITH_ERRORS);
      await agenda.now(JobNames.Bundle.process, { id });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(processContent).toHaveBeenCalled();

      // Should not process
      mockAndReset(Bundle.ProcessingStages.PROCESSING_CONTENT);
      await agenda.now(JobNames.Bundle.process, { id });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(processContent).not.toHaveBeenCalled();

      // Should proceed with processing
      mockAndReset(Bundle.ProcessingStages.ERROR);
      await agenda.now(JobNames.Bundle.process, { id });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(processContent).toHaveBeenCalled();

      // Should proceed with processing
      mockAndReset(Bundle.ProcessingStages.NOT_STARTED);
      await agenda.now(JobNames.Bundle.process, { id });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(processContent).toHaveBeenCalled();
    });

    it('Can schedule a unique job', async () => {
      // Simulate a long processing time to ensure the second job is attempted while the first is still running
      processContent.mockResolvedValue(0);

      await worker.stop();
      await agenda
        .create(JobNames.Bundle.process, { id: 'uniqueBundle' })
        .unique({ 'data.id': 'uniqueBundle' }, { insertOnly: true })
        .schedule('in 1 hr')
        .save();

      // If not unique, this would either run immediately or overwrite the first job to run immediately
      await agenda
        .create(JobNames.Bundle.process, { id: 'uniqueBundle' })
        .unique({ 'data.id': 'uniqueBundle' }, { insertOnly: true })
        .schedule('now')
        .save();

      // Wait enough time to ensure the second job would have run if it wasn't unique
      await worker.start();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // The processContent function should have been called only once
      expect(processContent).not.toHaveBeenCalled();
    });
  });

  describe('Newsletter.processArticles', () => {
    it('creates article processing jobs', async () => {
      const extractArticles = vi.fn().mockResolvedValue(0);
      vi.spyOn(Newsletter, 'findById').mockResolvedValue({
        extractArticles,
        articles: ['articleId1', 'articleId2'],
      });

      // Stop the worker to prevent automatic processing of jobs
      worker.stop();
      await agenda.create(JobNames.Newsletter.processArticles, { id: 'someNewsletterId' }).run();
      // Wait for this job to create the sub-jobs
      await new Promise((resolve) => setTimeout(resolve, 500));

      // get all jobs in the collection and verify there are two article processing jobs
      const collection = worker._collection.collectionName;
      const jobs = await worker._mdb.collection(collection).find({ name: JobNames.Article.process }).toArray();
      const idsInJobs = jobs.map((job) => job.data.id).sort();
      expect(jobs.length).toBe(2);
      expect(idsInJobs).toEqual(['articleId1', 'articleId2'].sort());
    });
  });
});
