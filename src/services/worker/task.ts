import 'dotenv/config';
import type { IJobParameters } from 'chronos-jobs';
import { DocumentType, getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose';
import { clearModelInDevelopment } from '@lib/models/utils';
import mongoose, { Types } from 'mongoose';
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
class JobClass<T = any> implements IJobParameters<T> {
  // Types without @prop are not persisted.
  // Only a few selected fields are persisted to allow simple queries as the rest of the job data
  // is managed by the task scheduler (Chronos/Agenda).

  public readonly _id!: Types.ObjectId;
  @prop({ type: String })
  public readonly name!: string;

  public readonly priority!: number;

  public readonly nextRunAt!: Date | null;

  public readonly type!: 'normal' | 'single';

  @prop({ type: Date })
  public readonly lockedAt?: Date;

  public readonly lastFinishedAt?: Date;

  public readonly failedAt?: Date;

  public readonly failCount?: number;

  public readonly failReason?: string;

  public readonly repeatTimezone?: string;

  public readonly lastRunAt?: Date;

  public readonly repeatInterval?: string | number;

  @prop({ type: Object })
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

export type ITask<DATA = any> = IJobParameters<DATA>;
export { JobModel as Task };
export type Task<DATA = any> = DocumentType<JobClass<DATA>>;
