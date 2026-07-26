import mongo from '@prisma-next/mongo/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };
import { ConnectionString } from 'mongodb-connection-string-url';
import { MongoClient } from 'mongodb';

export function db(dbName?: string) {
  return mongo<Contract>({
    contractJson,
    url: mongoUri,
    dbName,
  });
}

export const client = new MongoClient(process.env.MONGODB_URI!);

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not set');
}

let mongoUri = process.env.MONGODB_URI;
const cs = new ConnectionString(mongoUri);

if (cs.hosts.length > 1) {
  console.warn(
    `Multiple hosts in MongoDB connection string are not supported by Prisma.` +
      ` Using only the first host: ${cs.hosts[0]}`,
  );

  // Prisma does not support multiple hosts in the connection string.
  // See https://github.com/prisma/prisma-next/issues/578
  cs.hosts = [cs.hosts[0]];
}

mongoUri = cs.toString();
