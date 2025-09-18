import mongoose from 'mongoose';
import 'dotenv/config';

await mongoose.connect(process.env.MONGODB_URI || '', { dbName: process.env.DATABASE_NAME || 'Bento'});

export { Newsletter } from './newsletter';
export type { INewsletterProps } from './newsletter';
export { Article } from './article';
export type { IArticleProps } from './article';
