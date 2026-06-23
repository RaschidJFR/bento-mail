import 'dotenv/config';
import { defineConfig } from '@prisma-next/mongo/config';

export default defineConfig({
  contract: "./src/lib/prisma/contract.ts",
  outputPath: "./src/lib/prisma",
  db: {
    connection: process.env['MONGODB_URI']!,
  },
});
