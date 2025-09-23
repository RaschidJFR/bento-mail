import { DocumentType, getModelForClass, prop, index } from '@typegoose/typegoose';
import { type ObjectId } from 'mongoose';
import { clearModelInDevelopment } from './utils';

export interface IUser {
  _id?: ObjectId;
  email: string;
}

@index({ email: 1 }, { unique: true }) // Add index for email search
export class UserClass implements IUser {
  @prop({ required: true, unique: true, type: String })
  public email!: string;
}

clearModelInDevelopment('UserClass');
const UserModel = getModelForClass(UserClass);

export { UserModel as User };
export type User = DocumentType<UserClass>;
