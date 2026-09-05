import { MongoClient } from "mongodb";
import { afterAll, afterEach } from "vitest";

const client = new MongoClient(process.env.MONGODB_URI!);

afterEach(async () => {
  const db = client.db();
  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();
  await Promise.all(
    collections.map(({ name }) => db.collection(name).deleteMany({})),
  );
});

afterAll(async () => {
  await client.close();
});
