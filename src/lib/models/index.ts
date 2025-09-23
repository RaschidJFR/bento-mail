import mongoose from 'mongoose';
import 'dotenv/config';

await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.DATABASE_NAME || 'development' });

export { Newsletter } from './newsletter';
export type { INewsletter } from './newsletter';
export { Article } from './article';
export type { IArticle } from './article';
export { User } from './user';
export type { IUser } from './user';
export { Bundle } from './bundle';
export type { IBundle } from './bundle';
