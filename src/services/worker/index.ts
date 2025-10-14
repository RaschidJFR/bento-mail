import Agenda, { Job } from 'agenda';
import { defineJobs } from './job-definitions';
import { MongoClient } from 'mongodb';

/**
 * Initializes and configures an Agenda job scheduler instance.
 *
 * @returns Agenda ready instance with defined jobs.
 * @example
 * const agenda = await init();
 * await agenda.now(JobNames.Bundle.process, { id: 'bundleId' });
 */
export async function init(): Promise<Agenda> {
  let agenda = new Agenda().processEvery('30 seconds');

  agenda.on('start', (job: Job) => {
    console.log(`Job ${job.attrs._id} %o started.`, job.attrs.name);
  });

  agenda.on('success', (job: Job) => {
    console.log(`Job ${job.attrs._id} %o succeeded.`, job.attrs.name);
  });

  agenda.on('fail', (error: any, job: Job) => {
    console.error(
      `Job ${job.attrs._id} failed:\n\t> ${job.attrs.name} – ${
        job.attrs.failReason || error?.message || 'unknown reason'
      }`
    );
    console.error('\targs:', job.attrs.data);
    console.error(error.stack, '\n');
  });

  defineJobs(agenda);

  if (process.env.MONGODB_URI) {
    const client = await new MongoClient(process.env.MONGODB_URI).connect();
    const db = client.db(process.env.AGENDA_DB_NAME || 'agenda');

    agenda.mongo(db, process.env.AGENDA_COLLECTION);
    return new Promise((resolve) => agenda.on('ready', () => resolve(agenda)));
  } else if (process.env.NODE_ENV !== 'production') {
    // In non-production environments, allow running without DB for testing
    console.warn('Env var MONGODB_URI not set. Skipping Agenda database connection. Jobs will not persist.');
    (agenda.saveJob as any) = async function (this: Agenda, job: Job) {
      console.warn('Skipping job save %o since MONGODB_URI is not set.', job.attrs?.name);
      return job;
    };
  }
  return agenda;
}

export default init;
export { JobNames } from './job-definitions';
