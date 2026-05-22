import mongoose from 'mongoose';
import 'dotenv/config';

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
export type { ITask } from '@services/worker/task';

// Connect to the database when this module is imported
if (process.env.MONGODB_URI) {
  await mongoose.connect(process.env.MONGODB_URI!);
} else {
  console.warn('MONGODB_URI not set. Skipping database connection for models.');
}
