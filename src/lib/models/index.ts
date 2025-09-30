import mongoose from 'mongoose';
import 'dotenv/config';
import { ReturnModelType } from '@typegoose/typegoose';
import { Newsletter } from './newsletter';
import { Article } from './article';
import { User } from './user';
import { Bundle } from './bundle';
import { Reaction } from './reaction';

export { Newsletter } from './newsletter';
export type { INewsletter } from './newsletter';
export { Article } from './article';
export type { IArticle } from './article';
export { User } from './user';
export type { IUser } from './user';
export { Bundle } from './bundle';
export type { IBundle } from './bundle';
export { Reaction } from './reaction';
export type { IReaction } from './reaction';

// Connect to the database when this module is imported
if (process.env.MONGODB_URI) {
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.DATABASE_NAME || 'development' });
} else {
  console.warn('MONGODB_URI not set. Skipping database connection for models.');
}
