import 'dotenv/config';
import type { IJobParameters } from 'chronos-jobs';
import type { ObjectId } from 'mongodb';
import { DocumentType, getModelForClass, index, modelOptions } from '@typegoose/typegoose';
import { clearModelInDevelopment } from '@lib/models/utils';
import mongoose from 'mongoose';
import { COLLECTION_NAME, DB_NAME } from './vars';

// Connect to the database when this module is imported
const connection = process.env.MONGODB_URI
  ? mongoose.createConnection(process.env.MONGODB_URI, { dbName: DB_NAME })
  : undefined;

@modelOptions({
  existingConnection: connection,
  schemaOptions: {
    collection: COLLECTION_NAME,
  },
})
@index({ name: 1, lockedAt: 1, 'data.id': 1 }, { sparse: true })
class JobClass implements IJobParameters<any> {
  public readonly _id!: ObjectId;
  public readonly name!: string;
  public readonly priority!: number;
  public readonly nextRunAt!: Date | null;
  public readonly type!: 'normal' | 'single';
  public readonly lockedAt?: Date;
  public readonly lastFinishedAt?: Date;
  public readonly failedAt?: Date;
  public readonly failCount?: number;
  public readonly failReason?: string;
  public readonly repeatTimezone?: string;
  public readonly lastRunAt?: Date;
  public readonly repeatInterval?: string | number;
  public readonly data!: any;
  public readonly repeatAt?: string;
  public readonly disabled?: boolean;
  public readonly progress?: number;
  public readonly unique?: any;
  public readonly uniqueOpts?: { insertOnly: boolean };
  public readonly lastModifiedBy?: string;
  public readonly fork?: boolean;
}

clearModelInDevelopment('JobClass');
const JobModel = getModelForClass(JobClass);

export type ITask = IJobParameters<any>;
export { JobModel as Task };
export type Task = DocumentType<JobClass>;
