import { prop, getModelForClass, index, getName } from '@typegoose/typegoose';
import { clearModelInDevelopment } from '../models/utils';

/**
 * Account model for storing OAuth provider information
 */
@index({ userId: 1, provider: 1 }, { unique: true })
@index({ providerAccountId: 1, provider: 1 }, { unique: true })
export class AccountClass {
  @prop({ required: true, type: String })
  public userId!: string;

  @prop({ required: true, type: String })
  public provider!: string;

  @prop({ required: true, type: String })
  public providerAccountId!: string;

  @prop({ type: String })
  public refreshToken?: string;

  @prop({ type: String })
  public accessToken?: string;

  @prop({ type: Number })
  public expiresAt?: number;

  @prop({ type: String })
  public tokenType?: string;

  @prop({ type: String })
  public scope?: string;

  @prop({ type: String })
  public idToken?: string;

  @prop({ type: String })
  public sessionState?: string;
}

clearModelInDevelopment(getName(AccountClass));
const AccountModel = getModelForClass(AccountClass, {
  schemaOptions: { collection: 'accounts' },
});

export { AccountModel as Account };
export type Account = AccountClass;

/**
 * Session model for storing user sessions
 */
@index({ sessionToken: 1 }, { unique: true })
@index({ userId: 1 })
@index({ expiresAt: 1 })
export class SessionClass {
  @prop({ required: true, type: String })
  public sessionToken!: string;

  @prop({ required: true, type: String })
  public userId!: string;

  @prop({ required: true, type: Date })
  public expiresAt!: Date;

  @prop({ type: Date, default: () => new Date() })
  public createdAt?: Date;

  @prop({ type: Date, default: () => new Date() })
  public updatedAt?: Date;
}

clearModelInDevelopment(getName(SessionClass));
const SessionModel = getModelForClass(SessionClass, {
  schemaOptions: { collection: 'sessions' },
});

export { SessionModel as Session };
export type Session = SessionClass;

/**
 * VerificationToken model for email verification
 */
@index({ token: 1 }, { unique: true })
@index({ email: 1 })
export class VerificationTokenClass {
  @prop({ required: true, type: String })
  public email!: string;

  @prop({ required: true, type: String })
  public token!: string;

  @prop({ required: true, type: Date })
  public expiresAt!: Date;
}

clearModelInDevelopment(getName(VerificationTokenClass));
const VerificationTokenModel = getModelForClass(VerificationTokenClass, {
  schemaOptions: { collection: 'verification_tokens' },
});

export { VerificationTokenModel as VerificationToken };
export type VerificationToken = VerificationTokenClass;
