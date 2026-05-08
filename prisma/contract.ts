import mongoFamily from '@prisma-next/family-mongo/pack';
import { defineContract } from '@prisma-next/mongo-contract-ts/contract-builder';
import mongoTarget from '@prisma-next/target-mongo/pack';

export const contract = defineContract(
  { family: mongoFamily, target: mongoTarget },
  ({ field, model, rel }) => ({
    models: {
      User: model('User', {
        collection: 'users',
        fields: {
          _id: field.objectId(),
          email: field.string(),
          name: field.string().optional(),
        },
        relations: {
          posts: rel.hasMany('Post', { from: '_id', to: 'authorId' }),
        },
      }),

      Post: model('Post', {
        collection: 'posts',
        fields: {
          _id: field.objectId(),
          title: field.string(),
          content: field.string().optional(),
          authorId: field.objectId(),
        },
        relations: {
          author: rel.belongsTo('User', { from: 'authorId', to: '_id' }),
        },
      }),
    },
  }),
);
