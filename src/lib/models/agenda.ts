import Agenda, { JobAttributes } from 'agenda';
import 'dotenv/config';
import { ObjectId } from 'mongodb';
import { DocumentType, getModelForClass, modelOptions } from '@typegoose/typegoose';
import { clearModelInDevelopment } from './utils';
import { Mongoose } from 'mongoose';

// Connect to the database when this module is imported
const mg = await new Mongoose().connect(process.env.MONGODB_URI!, {
  dbName: process.env.AGENDA_DB_NAME || 'agenda',
});
const agenda = new Agenda({ mongo: mg.connection.db as any });

@modelOptions({
  existingConnection: mg.connection,
  schemaOptions: {
    collection: agenda._collection.collectionName,
  },
})
class JobClass implements JobAttributes {
  // No need to add @prop decorator as Agenda is taking care of the model
  public readonly _id!: ObjectId;
  public readonly agenda!: Agenda;
  public readonly name!: string;
  public readonly data!: any;
  public readonly type!: string;
  public readonly priority!: number | string;
  public readonly nextRunAt?: Date;
  public readonly lastRunAt?: Date;
  public readonly lastFinishedAt?: Date;
  public readonly repeatInterval?: string;
  public readonly repeatTimezone?: string;
  public readonly failReason?: string;
  public readonly failedAt?: Date;
  public readonly failCount?: number;
  public readonly lockedAt?: Date;
  public readonly lastModifiedBy?: string;
}

clearModelInDevelopment('JobClass');
const JobModel = getModelForClass(JobClass);

export { JobModel as WorkerJob, type JobAttributes as IWorkerJob };
export type WorkerJob = DocumentType<JobClass>;
