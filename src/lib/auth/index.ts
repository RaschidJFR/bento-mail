import { betterAuth } from 'better-auth';
import { mongodbAdapter } from './mongodb-adapter';
import { Account, Session, VerificationToken } from './models';

export const auth = betterAuth({
  database: mongodbAdapter({
    account: Account,
    session: Session,
    verificationToken: VerificationToken,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  trustedOrigins: [process.env.APP_URL as string],
  appName: 'Bento Mail',
  basePath: '/api/auth',
});
