import { DocumentType, getModelForClass, prop } from '@typegoose/typegoose';
import type { ObjectId } from 'mongoose';

export interface IUserProps {
  _id?: ObjectId;
  email: string;
}

export class UserClass implements IUserProps {
  @prop({ required: true, unique: true, type: String })
  public email!: string;
}

const UserModel = getModelForClass(UserClass);
export { UserModel as User };
export type User = DocumentType<UserClass>;