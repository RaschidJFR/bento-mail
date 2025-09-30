import { getModelForClass, getName, prop, index, queryMethod } from '@typegoose/typegoose';
import type { DocumentType, Ref, types } from '@typegoose/typegoose';
import { clearModelInDevelopment } from './utils';
import { Article, User } from '.';
import { UserClass } from './user';
import { ArticleClass } from './article';
import { Types } from 'mongoose';

/**
 * Enum representing possible reactions to an article.
 */
export enum ReactionsEnum {
  PROBLEM = -2,
  NEGATIVE = -1,
  ACKNOWLEDGED = 1,
  POSITIVE = 2,
}

export interface IReaction {
  user: Ref<UserClass>;
  article: Ref<ArticleClass>;
  reaction: ReactionsEnum;
}

function findByUser(this: types.QueryHelperThis<typeof Reaction, QueryHelpers>, user: string | Types.ObjectId) {
  return this.find({ user });
}

function findByArticle(this: types.QueryHelperThis<typeof Reaction, QueryHelpers>, article: string | Types.ObjectId) {
  return this.find({ article });
}

@queryMethod(findByUser) // adds the "findByUser" method to the model
@queryMethod(findByArticle) // adds the "findByArticle" method to the model
@index({ user: 1, article: 1 }, { unique: true })
export class ReactionClass implements IReaction {
  @prop({ ref: () => User, required: true })
  public user!: Ref<UserClass>;
  @prop({ ref: () => Article, type: String, required: true })
  public article!: Ref<Article>;
  @prop({ type: Number, enum: ReactionsEnum, required: true })
  public reaction!: ReactionsEnum;
}

interface QueryHelpers {
  // use the actual function types dynamically
  findByUser: types.AsQueryMethod<typeof findByUser>;
  findByArticle: types.AsQueryMethod<typeof findByArticle>;
}

clearModelInDevelopment(getName(ReactionClass));
const ReactionModel = getModelForClass<typeof ReactionClass, QueryHelpers>(ReactionClass);

export { ReactionModel as Reaction };
export type Reaction = DocumentType<ReactionClass>;
