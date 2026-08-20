import 'dotenv/config';
import { defineConfig } from '@prisma/orm-mongo/config';

export default defineConfig({
  contract: "./src/lib/prisma/contract.ts",
  db: {
    connection: process.env['MONGODB_URI']!,
  },
});
