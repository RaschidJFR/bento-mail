import { JobNames } from '@services/worker';
import { Bundle } from '@lib/models';
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
});
