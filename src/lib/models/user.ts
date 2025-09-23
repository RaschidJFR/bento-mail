import { DocumentType, getModelForClass, prop } from '@typegoose/typegoose';
import { type ObjectId } from 'mongoose';
import { clearModelInDevelopment } from './utils';

export interface IUser {
  _id?: ObjectId;
  email: string;
}

export class UserClass implements IUser {
  @prop({ required: true, unique: true, type: String })
  public email!: string;
}

clearModelInDevelopment('UserClass');
const UserModel = getModelForClass(UserClass);

export { UserModel as User };
export type User = DocumentType<UserClass>;