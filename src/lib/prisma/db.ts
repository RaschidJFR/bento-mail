import mongo from '@prisma-next/mongo/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };
import { ConnectionString } from 'mongodb-connection-string-url';
import { MongoClient } from 'mongodb';

export function db(dbName?: string) {
  let mongoUri = process.env.MONGODB_URI!;
  if (dbName) {
    const cs = new ConnectionString(mongoUri);
    cs.pathname = `/${dbName}`;
    // Prisma does not support multiple hosts in the connection string.
    // See https://github.com/prisma/prisma-next/issues/578
    cs.hosts = [cs.hosts[0]];
    mongoUri = cs.toString();
  }

  return mongo<Contract>({
    contractJson,
    url: mongoUri,
  });
}

export const client = new MongoClient(process.env.MONGODB_URI!);