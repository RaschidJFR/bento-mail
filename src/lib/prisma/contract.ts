// To bootstrap the database from this contract, use:
//   npx prisma-next contract emit
//   npx prisma-next db init --db "$DATABASE_URL" --yes

import mongoFamily from "@prisma-next/family-mongo/pack";
import { defineContract } from "@prisma-next/mongo-contract-ts/contract-builder";
import mongoTarget from "@prisma-next/target-mongo/pack";

export const COLLECTION_NAMES = {
  articles: 'articles',
  bundles: 'bundles',
  newsletters: 'newsletters',
  reactions: 'reactions',
  users: 'users',
};

export const contract = defineContract(
  { family: mongoFamily, target: mongoTarget }, // What's this line?
  ({ field, index, model, rel, valueObject }) => {
    const Summaries = valueObject("Summaries", {
      fields: {
        oneliner: field.string(),
        overview: field.string(),
        details: field.string(),
      },
    });

    const BasicArticle = valueObject("BasicArticle", {
      fields: {
        content: field.string(),
        header: field.string(),
        url: field.string().optional(),
        date: field.string().optional(), // TODO: change this to Date
        coverImg: field.string().optional(),
        sourceName: field.string().optional(),
        lastError: field.string().optional(),
      },
    });

    const LinkedArticle = valueObject("LinkedArticle", {
      fields: {
        header: field.string(),
        content: field.string(),
        url: field.string().optional(),
        coverImg: field.string().optional(),
      },
    });

    const Article = model("Article", {
      collection: COLLECTION_NAMES.articles,
      fields: {
        _id: field.string(),
        content: field.string().optional(),
        header: field.string(),
        url: field.string().optional(),
        date: field.string().optional(),
        coverImg: field.string().optional(),
        sourceName: field.string(),
        summaries: field.valueObject(Summaries).optional(),
        linkedArticles: field.valueObject(LinkedArticle).many().optional(),
        lastError: field.string().optional(),
      },
      indexes: [
        index({ lastError: 1 }, { sparse: true }),
        index({ sourceName: 1, date: -1, _id: 1 }),
      ],
    });

    const User = model("User", {
      collection: COLLECTION_NAMES.users,
      fields: {
        _id: field.objectId(),
        email: field.string(),
        aliasEmail: field.string().optional(),
        name: field.string().optional(),  // TODO: remove (not used)
        image: field.string().optional(), // TODO: remove (not used)
      },
      indexes: [
        index(
          { email: 1 },
          {
            unique: true,
            partialFilterExpression: { email: { $type: "string" } },
          },
        ),
        index(
          { aliasEmail: 1 },
          {
            unique: true,
            partialFilterExpression: { aliasEmail: { $type: "string" } },
          },
        ),
      ],
    });

    const Newsletter = model("Newsletter", {
      collection: COLLECTION_NAMES.newsletters,
      fields: {
        _id: field.string(),
        content: field.string(),
        articles: field.string().many(),
        date: field.string().optional(),
        name: field.string().optional(),
        url: field.string().optional(),
        error: field.string().optional(),
      },
      relations: {
        articleRefs: rel.hasMany(Article, {
          from: "articles",
          to: Article.ref("_id"),
        }),
      },
      indexes: [index({ error: 1 }, { sparse: true }), index({ date: -1 })],
    });

    const Bundle = model("Bundle", {
      collection: COLLECTION_NAMES.bundles,
      fields: {
        _id: field.objectId(),
        sendOn: field.date().optional(),
        user: field.objectId(),
        newsletters: field.string().many().optional(),
        articles: field.string().many().optional(),
        processingStage: field.int32(),
      },
      relations: {
        userRef: rel.belongsTo(User, { from: "user", to: User.ref("_id") }),
        newsletterRefs: rel.hasMany(Newsletter, {
          from: "newsletters",
          to: Newsletter.ref("_id"),
        }),
        articleRefs: rel.hasMany(Article, {
          from: "articles",
          to: Article.ref("_id"),
        }),
      },
      indexes: [
        index(
          { processingStage: 1, sendOn: 1, user: 1, _id: -1 },
          { unique: true },
        ),
      ],
    });

    const Reaction = model("Reaction", {
      collection: COLLECTION_NAMES.reactions,
      fields: {
        _id: field.objectId(),
        user: field.objectId(),
        article: field.string(),
        reaction: field.int32(),
        date: field.date().optional(),
      },
      relations: {
        userRef: rel.belongsTo(User, { from: "user", to: User.ref("_id") }),
        articleRef: rel.belongsTo(Article, {  // Why belongs and not hasOne?
          from: "article",
          to: Article.ref("_id"),
        }),
      },
      indexes: [index({ user: 1, article: 1 }, { unique: true })],
    });

    return {
      models: { User, Article, Newsletter, Bundle, Reaction },
      valueObjects: { Summaries, BasicArticle, LinkedArticle },
    };
  },
);
