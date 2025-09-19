import mongoose from 'mongoose';
import 'dotenv/config';

await mongoose.connect(process.env.MONGODB_URI || '', { dbName: process.env.DATABASE_NAME || 'Bento' });

export { Newsletter } from './newsletter';
export type { INewsletterProps } from './newsletter';
export { Article } from './article';
export type { IArticleProps } from './article';
export { User } from './user';
export type { IUserProps } from './user';
export { Bundle } from './bundle';
export type { IBundle } from './bundle';
