import 'dotenv/config';
import { db, client } from '@lib/prisma/db';
import type { InferRootRow } from '@prisma-next/mongo-orm';
import type { Contract } from '@lib/prisma/contract.d';
import { MongoFieldFilter, MongoOrExpr } from '@prisma-next/mongo-query-ast/execution';
import { ChangeStream, Collection } from 'mongodb';
import type { ChangeStreamOptions, Document } from 'mongodb';
import { COLLECTION_NAME, DB_NAME } from './vars';

export type ITask = InferRootRow<Contract, 'Task'>;

const tasks = db(DB_NAME).orm.tasks;

async function findActiveArticleProcessTasks(articleIds: readonly string[], jobName: string) {
  const idSet = new Set(articleIds);
  const results = await tasks
    .where({ name: jobName })
    .where(MongoOrExpr.of([MongoFieldFilter.isNotNull('lockedAt'), MongoFieldFilter.isNotNull('nextRunAt')]))
    .all()
    .toArray();
  return results.filter((row) => {
    const articleId = row.data?.id;
    return !!articleId && idSet.has(articleId);
  });
}

let taskCollection: Collection<ITask> | null = null;

async function getCollection(): Promise<Collection<ITask>> {
  if (taskCollection) return taskCollection;
  taskCollection = client.db(DB_NAME).collection<ITask>(COLLECTION_NAME);
  return taskCollection;
}

async function watch<TSchema extends Document = ITask>(
  pipeline: Document[] = [],
  options?: ChangeStreamOptions,
): Promise<ChangeStream<TSchema>> {
  const collection = await getCollection();
  return collection.watch<TSchema>(pipeline, options);
}

export const Task = Object.assign(tasks, {
  findActiveArticleProcessTasks,
  watch,
});
