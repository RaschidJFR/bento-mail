import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const mongoUri = process.env.MONGODB_URI!;
const dbName = process.env.DATABASE_NAME || 'development';
const client = new MongoClient(mongoUri);
const db = client.db(dbName);

export const auth = betterAuth({
  database: mongodbAdapter(db, { client }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  trustedOrigins: [process.env.APP_URL || 'http://localhost:3000'],
  appName: 'Bento Mail',
  basePath: '/api/auth',
  schema: {
    user: {
      modelName: 'users',
    },
  },
});
