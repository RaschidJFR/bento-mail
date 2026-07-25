import { JobNames } from '@services/worker';
import { Bundle, Newsletter } from '@lib/models';
import { Chronos as Agenda, Job } from 'chronos-jobs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, Mock, MockInstance, vi } from 'vitest';
import { IBundle, ProcessingStagesEnum } from '@lib/models/bundle';

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
    await agenda.db.collection.deleteMany({});
  });

  afterAll(async () => {
    console.log('Agenda stop. Cleaning up test database...');
    await worker.stop();
    await agenda.stop();
    console.log('Agenda database cleaned up.');
  });

  it('Agenda is using the designated db', async () => {
    vi.mock('@services/worker', async () => {
      vi.stubEnv('AGENDA_DB_NAME', 'pechuga');
      vi.stubEnv('AGENDA_COLLECTION', 'de pollo');
      return await vi.importActual('@services/worker');
    });
    const { default: initWorker } = await import('@services/worker');
    const w = await initWorker();
    expect(w.db.collection.dbName).toBe('pechuga');
    expect(w.db.collection.collectionName).toBe('de pollo');

    await w.db.collection.db.dropDatabase();
    await w.stop();
  });

  it('Job.save() is bypassed when no MONGODB_URI is unset in non-production environment', async () => {
    vi.stubEnv('MONGODB_URI', '');
    vi.stubEnv('NODE_ENV', 'notproduction');
    const { Job } = await import('chronos-jobs');
    const originalSave = vi.spyOn(Job.prototype, 'save');

    let instantiate = (await import('@services/worker')).default;
    let localAgenda = await instantiate();
    await expect(localAgenda.create('someJob', {}).save()).resolves.not.toThrow();
    expect(originalSave).not.toHaveBeenCalled();
  });

  it('Job.save() should not be bypassed in production', async () => {
    vi.stubEnv('MONGODB_URI', '');
    vi.stubEnv('NODE_ENV', 'production');
    const { Job } = await import('chronos-jobs');
    const originalSave = vi.spyOn(Job.prototype, 'save').mockResolvedValue(Job.prototype);

    let { default: instantiate } = await import('@services/worker');
    let localAgenda = await instantiate();

    const job = localAgenda.create('someJob', {});
    await expect(job.save()).resolves.not.toThrow();
    expect(originalSave).toHaveBeenCalled();
  });

  describe('Bundle.process', () => {
    let processContent: MockInstance;

    beforeEach(() => {
      // Mock the Bundle class that will be called by the job
      processContent = vi.spyOn(Bundle, 'processContent').mockResolvedValue(0);
      vi.spyOn(Bundle, 'findById').mockResolvedValue({
        _id: 'bundle123',
        processingStage: Bundle.ProcessingStages.NOT_STARTED,
      } as any);
    });

    it('process one bundle', async () => {
      await agenda.now(JobNames.Bundle.process, { id: 'bundle123' });

      // Wait for the job to complete
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(Bundle.processContent).toHaveBeenCalled();
    });

    it('fail if bundle has already been processed', async () => {
      const id = 'bundleId';

      function mockAndReset(stage: ProcessingStagesEnum) {
        processContent.mockClear();
        vi.spyOn(Bundle, 'findById').mockReturnValue({
          processingStage: stage,
        } as any);
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
      vi.spyOn(Newsletter, 'extractArticles').mockResolvedValue(0);
      vi.spyOn(Newsletter, 'findById').mockResolvedValue({
        _id: 'someNewsletterId',
        articles: ['articleId1', 'articleId2'],
      } as any);
      
      // Stop the worker to prevent automatic processing of jobs
      worker.stop();
      const job = await agenda.create(JobNames.Newsletter.processArticles, { id: 'someNewsletterId' }).save();
      await job.run();
      // Wait for this job to create the sub-jobs
      await new Promise((resolve) => setTimeout(resolve, 500));

      // get all jobs in the collection and verify there are two article processing jobs
      const jobs = await worker.jobs({ name: JobNames.Article.process });
      const idsInJobs = jobs.map((job: Job<any>) => job.attrs.data.id).sort();
      expect(jobs.length).toBe(2);
      expect(idsInJobs).toEqual(['articleId1', 'articleId2'].sort());
    });
  });
});
