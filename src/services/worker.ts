import Agenda, { type Job } from 'agenda';
import { Bundle } from '@lib/models';

export const JobNames = Object.freeze({
  Bundle: {
    process: 'bundle.process',
  },
});

/**
 * Initializes and configures an Agenda job scheduler.
 * @returns Agenda instance with defined jobs and event listeners
 */
export function init() {
  const agenda = new Agenda();

  agenda.on('start', (job: Job) => {
    console.log(`Job ${job.attrs._id} started: ${job.attrs.name}`);
  });

  agenda.on('success', (job: Job) => {
    console.log(`Job ${job.attrs._id} succeeded: ${job.attrs.name}`);
  });

  agenda.on('fail', (error, job: Job) => {
    console.error(
      `Job ${job.attrs._id} failed:\n\t> ${job.attrs.name} – ${
        job.attrs.failReason || error?.message || 'unknown reason'
      }`
    );
    console.error('\targs:', job.attrs.data);
    console.error(error.stack, '\n');
  });

  agenda.define(JobNames.Bundle.process, { shouldSaveResult: true }, async (job: Job<{ id: string }>) => {
    const id = job.attrs.data?.id;
    if (!id) {
      throw new Error('Missing bundleId');
    }
    const bundle = await Bundle.findById({ _id: id });
    if (!bundle) {
      throw new Error(`Bundle not found: ${id}`);
    } else if (bundle.processingStage > Bundle.ProcessingStages.NOT_STARTED) {
      throw new Error(`Bundle ${id} already processed: ${Bundle.ProcessingStages[bundle.processingStage]}`);
    }

    try {
      // Using pulsecheck to keep the job locked
      const errors = await bundle.processContent({ pulsecheck: () => job.touch() });
      return { errors, status: bundle.processingStage };
    } catch (err) {
      console.error(`[worker] Error unpacking newsletters in bundle ${id}:`, err);
      throw err;
    }
  });

  return agenda;
}

export default init;
