import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';
import 'dotenv/config';
import ConnectionString from 'mongodb-connection-string-url';

const mongoUri = process.env.MONGODB_URI!;
const dbName = getDbName(mongoUri);
const client = new MongoClient(mongoUri);
const db = client.db(dbName);
const trustedOrigins = process.env.APP_URL
  ? [process.env.APP_URL]
  : process.env.NODE_ENV === 'development'
    ? ['http://localhost:3000']
    : [];

export const auth = betterAuth({
  database: mongodbAdapter(db, { client }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  trustedOrigins,
  appName: 'Bento Mail',
  basePath: '/api/auth',
  user: {
    modelName: 'users',
  },
});

function getDbName(uri: string) {
  const cs = new ConnectionString(uri);
  return cs.pathname?.replace(/^\//, '') || '';
}
