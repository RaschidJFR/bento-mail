import { ObjectId } from 'mongodb';
import { Pipeline } from '@pipesafe/core';

const COLLECTION_NAMES = {
  bundles: 'bundles',
  newsletters: 'newsletters',
  articles: 'articles',
  reactions: 'reactions',
};

enum ProcessingStagesEnum {
  COMPLETED_WITH_ERRORS = -2,
  ERROR = -1,
  NOT_STARTED = 0,
  PROCESSING_CONTENT = 1,
  CONTENT_PROCESSED = 2,
  SENT = 3,
}

type TBundle = {
  _id: ObjectId;
  sendOn?: Date;
  user: ObjectId;
  newsletters?: string[];
  articles?: string[];
  processingStage: ProcessingStagesEnum;
};

type TNewsletter = {
  _id: string;
  articles: string[];
};

type TArticle = {
  _id: string;
  content?: string;
  header: string;
  url?: string;
  date?: string;
  coverImg?: string;
  sourceName?: string;
  summaries?: {
    oneliner: string;
    overview: string;
    details: string;
  };
  lastError?: string;
};

function fetchUnreadArticleIds(bundleId: ObjectId) {
  type AfterReactionsLookup = TBundle & {
    allArticleIds: string[];
    reactions: Array<{ article: string }>;
  };

  const pipeline = populateNewsletters(
    new Pipeline<TBundle>().match({ _id: bundleId })
  );

  return (
    pipeline
      // Collect all article IDs from both direct articles and newsletter articles
      .set({
        allArticleIds: {
          $setUnion: [
            { $ifNull: ['$articles', []] },
            {
              $reduce: {
                input: '$newsletters',
                initialValue: [],
                in: { $concatArrays: ['$$value', { $ifNull: ['$$this.articles', []] }] },
              },
            },
          ],
        },
      })
      // Lookup reactions for this user
      // Custom stage needed in order to use `pipeline`
      .custom<AfterReactionsLookup>([
        {
          $lookup: {
            from: COLLECTION_NAMES.reactions,
            as: 'reactions',
            let: { articleIds: '$allArticleIds', userId: '$user' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $in: ['$article', '$$articleIds'] }, { $eq: ['$user', '$$userId'] }],
                  },
                },
              },
              { $project: { article: 1, _id: 0 } },
            ],
          },
        },
      ])
      .set({
        unreadArticles: {
          // Using custom as project() doesn't recognize $setDifference
          $setDifference: ['$allArticleIds', { $map: { input: '$reactions', in: '$$this.article' } }],
        },
      })
      .unset(['reactions'])
  );
}

function populateNewsletters<
  T extends Record<string, any> = {
    _id: ObjectId;
    sendOn?: Date | undefined;
    user: ObjectId;
    newsletters?: string[] | undefined;
    articles?: string[] | undefined;
    processingStage: ProcessingStagesEnum;
  },
>(pipeline: Pipeline<TBundle, T, 'runtime', '$match'>) {
  return pipeline.custom<T & { newsletters?: TNewsletter[] }>([
    {
      $lookup: {
        from: COLLECTION_NAMES.newsletters,
        let: { newsletterIds: '$newsletters' },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$_id', '$$newsletterIds'] },
            },
          },
          { $sort: { date: -1 } },
        ],
        as: 'newsletters',
      },
    },
  ]);
}

export function populateUnreadArticles(bundleId: ObjectId) {
  type BundleWithPopulatedArticles = {
    _id: ObjectId;
    sendOn?: Date;
    user: ObjectId;
    newsletters: Array<TNewsletter & { articles: TArticle[] }>;
    articles: string[];
    allArticleIds: string[];
    unreadArticles: TArticle[];
    processingStage: ProcessingStagesEnum;
  };

  type SetArticleMap = BundleWithPopulatedArticles & {
    articleMap: Record<string, TArticle>;
  };

  type SetArticlesNewsletters = SetArticleMap & {
    articles: TArticle[];
    newsletters: Array<TNewsletter & { articles: TArticle[] }>;
  };

  return fetchUnreadArticleIds(bundleId)
    .custom<BundleWithPopulatedArticles>([
      {
        $lookup: {
          from: COLLECTION_NAMES.articles,
          as: 'unreadArticles',
          let: { unread: '$unreadArticles' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $in: ['$_id', '$$unread'] }, { $eq: [{ $ifNull: ['$lastError', ''] }, ''] }],
                },
              },
            },
          ],
        },
      },
    ])
    .custom<SetArticleMap>([
      {
        $set: {
          articleMap: {
            // Using custom stage as $arrayToObject isn't recognized by project()
            $arrayToObject: {
              // $map not supported in project() either, so using custom stage for the whole thing
              $map: {
                input: '$unreadArticles',
                as: 'a',
                in: ['$$a._id', '$$a'],
              },
            },
          },
        },
      },
    ])
    .custom<SetArticlesNewsletters>([
      {
        $set: {
          articles: {
            $filter: {
              input: {
                $map: {
                  input: '$articles',
                  as: 'a',
                  in: {
                    $ifNull: [{ $getField: { field: '$$a', input: '$articleMap' } }, null],
                  },
                },
              },
              as: 'article',
              cond: { $ne: ['$$article', null] },
            },
          },
          newsletters: {
            $map: {
              input: '$newsletters',
              as: 'n',
              in: {
                $mergeObjects: [
                  '$$n',
                  {
                    articles: {
                      $filter: {
                        input: {
                          $map: {
                            input: '$$n.articles',
                            as: 'a',
                            in: {
                              $ifNull: [{ $getField: { field: '$$a', input: '$articleMap' } }, null],
                            },
                          },
                        },
                        as: 'article',
                        cond: { $ne: ['$$article', null] },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ])
    .unset(['articleMap', 'unreadArticles'])
    .project({
      _id: 1,
      user: 1,
      newsletters: 1,
      articles: 1,
      allArticleIds: 1,
    });
}
