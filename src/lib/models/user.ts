import { DocumentType, getModelForClass, prop, index } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import { clearModelInDevelopment } from './utils';
import { Base } from '@typegoose/typegoose/lib/defaultClasses';

export interface IUser extends Base {
  email: string;
}

@index({ email: 1 }, { unique: true }) // Add index for email search
export class UserClass implements IUser {
  public _id!: Types.ObjectId;
  public id!: string;

  @prop({ required: true, unique: true, type: String })
  public email!: string;
}

clearModelInDevelopment('UserClass');
// Specify collection name to avoid name changes due to minification in production
const UserModel = getModelForClass(UserClass, { schemaOptions: { collection: 'users' } });

export { UserModel as User };
export type User = DocumentType<UserClass>;
