import type { InferRootRow, MongoWhereFilter } from '@prisma-next/mongo-orm';
import { MongoFieldFilter, MongoOrExpr } from '@prisma-next/mongo-query-ast/execution';
import type { Contract } from '@lib/prisma/contract.d';
import { db } from '@lib/prisma/db';
import { ObjectId } from 'mongodb';

export type IUser = InferRootRow<Contract, 'User'>;

const users = db().orm.users;

/**
 * Convenience method.
 * Short for `users.where({ _id: String(id) }).select('_id').first()`
 */
async function exists(filter: MongoWhereFilter<Contract, 'User'>,): Promise<ObjectId | null> {
  const result = await users.where(filter).select('_id').first();
  return result?._id ?new ObjectId(result._id) : null;
}

/**
 * Match a user by `email` or `aliasEmail`.
 */
function findByEmail(email: string) {
  return users.where(
    MongoOrExpr.of([MongoFieldFilter.eq('email', email), MongoFieldFilter.eq('aliasEmail', email)]),
  ).first();
}

export const User = Object.assign(users, { findByEmail, exists });