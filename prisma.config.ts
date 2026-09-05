import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-mongo/config';

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./src/lib/prisma/contract.ts",
    db: {
      connection: process.env['MONGODB_URI']!,
    },
  }),
});
