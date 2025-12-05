import { BetterAuthOptions } from 'better-auth';
import { Model } from 'mongoose';

interface MongoDBAdapterOptions {
  account: Model<any>;
  session: Model<any>;
  verificationToken: Model<any>;
}

/**
 * MongoDB adapter for Better Auth using Typegoose models
 */
export function mongodbAdapter(options: MongoDBAdapterOptions): BetterAuthOptions['database'] {
  return {
    type: 'mongodb',
    options: {
      account: options.account,
      session: options.session,
      verificationToken: options.verificationToken,
    },
  } as any;
}
