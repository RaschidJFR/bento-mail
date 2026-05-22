import 'dotenv/config';
import { defineConfig } from '@prisma-next/mongo/config';

export default defineConfig({
  contract: "./prisma/contract.ts",
  db: {
    connection: process.env['MONGODB_URI']!,
  },
});
