import { DocumentType, getModelForClass, prop, index, getName, types, queryMethod } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { clearModelInDevelopment } from './utils';
import { Base } from '@typegoose/typegoose/lib/defaultClasses';

export interface IUser extends Base {
  email: string;
  aliasEmail?: string;
}

interface QueryHelpers {
  /**
   * Find user by email or aliasEmail
   */
  findByEmail: types.AsQueryMethod<typeof findByEmail>;
}

function findByEmail(this: types.QueryHelperThis<typeof UserClass, QueryHelpers>, email: string) {
  return this.findOne({ $or: [{ email }, { aliasEmail: email }] });
}

@queryMethod(findByEmail)
@index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } })
@index({ aliasEmail: 1 }, { unique: true, partialFilterExpression: { aliasEmail: { $type: 'string' } } })
export class UserClass implements IUser {
  public _id!: Types.ObjectId;
  public id!: string;

  @prop({ required: true, type: String })
  public email!: string;

  @prop({ type: String })
  public aliasEmail?: string;
}

clearModelInDevelopment(getName(UserClass));
const UserModel = getModelForClass<typeof UserClass, QueryHelpers>(UserClass, {
  schemaOptions: { collection: 'users' },
});

export { UserModel as User };
export type User = DocumentType<UserClass>;
