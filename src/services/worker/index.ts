import Agenda, { type Job } from 'agenda';
import { defineJobs } from './job-definitions';
export { JobNames } from './job-definitions';

/**
 * Initializes and configures an Agenda job scheduler instance.
 * 
 * @returns Agenda ready instance with defined jobs.
 * @example
 * const agenda = await init();
 * await agenda.now(JobNames.Bundle.process, { id: 'bundleId' });
 */
export async function init(): Promise<Agenda> {
  const agenda = new Agenda().processEvery('30 seconds');

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

  defineJobs(agenda);
  
  agenda.database(process.env.MONGODB_URI!, process.env.AGENDA_COLLECTION);
  await new Promise((resolve) => agenda.on('ready', () => resolve(agenda)));
  return agenda;
}

export default init;
