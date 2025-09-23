import mongoose from 'mongoose';
import 'dotenv/config';
import { ReturnModelType } from '@typegoose/typegoose';
import { Newsletter } from './newsletter';
import { Article } from './article';
import { User } from './user';
import { Bundle } from './bundle';

export { Newsletter } from './newsletter';
export type { INewsletter } from './newsletter';
export { Article } from './article';
export type { IArticle } from './article';
export { User } from './user';
export type { IUser } from './user';
export { Bundle } from './bundle';
export type { IBundle } from './bundle';

export async function ensureIndexes(mongoose: mongoose.Mongoose): Promise<void> {
  // Throw an error if not connected
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Mongoose is not connected. Please connect before ensuring indexes.');
  }

  const modelList: ReturnModelType<any>[] = [Newsletter, Article, User, Bundle];

  for (const model of modelList) {
    if (model && typeof model.ensureIndexes === 'function') {
      console.log(`Ensuring indexes for ${model.modelName}...`);
      try {
        await model.ensureIndexes();
      } catch (error) {
        console.error(`Error ensuring indexes for ${model.modelName}:`, error);
      }
    }
  }

  console.log('All indexes ensured.');
}

// Connect to the database when this module is imported
await mongoose.connect(process.env.MONGODB_URI!, { dbName: process.env.DATABASE_NAME || 'development' });
