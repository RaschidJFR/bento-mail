import { ObjectId } from 'mongodb';
import { COLLECTION_NAMES } from '@lib/prisma/contract';

export function populateUnreadArticles(bundleId: string) {
  return [
    // 1. Target the single bundle by _id (primary key).
    {
      $match: {
        _id: ObjectId.createFromHexString(bundleId),
      },
    },
    // 2. Hydrate newsletters (id order preserved by the sort below).
    //    `content` is stripped inside the lookup to keep the payload small.
    {
      $lookup: {
        from: COLLECTION_NAMES.newsletters,
        localField: 'newsletters',
        foreignField: '_id',
        as: 'newsletters',
        pipeline: [
          { $project: { content: 0 } },
          { $sort: { date: -1 } },
        ],
      },
    },
    // 3. Collect every article id referenced by the bundle or its newsletters.
    {
      $set: {
        allArticleIds: {
          $setUnion: [
            { $ifNull: ['$articles', []] },
            {
              $reduce: {
                input: '$newsletters',
                initialValue: [],
                in: {
                  $concatArrays: ['$$value', { $ifNull: ['$$this.articles', []] }],
                },
              },
            },
          ],
        },
      },
    },
    // 4. Fetch this user's reactions for the collected article ids. Only
    //    `$eq` inside `$expr` can hit the { user: 1, article: 1 } index, so
    //    the planner will scan by `user` and filter `article` at runtime.
    {
      $lookup: {
        from: COLLECTION_NAMES.reactions,
        as: 'reactedArticles',
        let: { articleIds: '$allArticleIds', userId: '$user' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$user', '$$userId'] },
                  { $in: ['$article', '$$articleIds'] },
                ],
              },
            },
          },
          { $project: { _id: 0, article: 1 } },
        ],
      },
    },
    // 5. Subtract reacted ids from the union to derive the unread set.
    {
      $set: {
        unreadArticles: {
          $setDifference: [
            '$allArticleIds',
            { $map: { input: '$reactedArticles', in: '$$this.article' } },
          ],
        },
      },
    },
    { $unset: ['reactedArticles'] },
    // 6. Hydrate only the unread, error-free articles as a keyed object so
    //    the following stages can look up each id in O(1).
    {
      $lookup: {
        from: COLLECTION_NAMES.articles,
        as: 'unreadArticles',
        let: { unread: '$unreadArticles' },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$_id', '$$unread'] },
              lastError: { $in: [null, ''] },
            },
          },
          { $project: { content: 0 } },
        ],
      },
    },
    {
      $set: {
        unreadArticles: {
          $arrayToObject: {
            $map: {
              input: '$unreadArticles',
              as: 'a',
              in: ['$$a._id', '$$a'],
            },
          },
        },
      },
    },
    // 7. Replace the id arrays in `articles` and `newsletters[].articles`
    //    with the hydrated docs, dropping ids that were read or errored.
    {
      $set: {
        articles: {
          $filter: {
            input: {
              $map: {
                input: '$articles',
                as: 'a',
                in: {
                  $ifNull: [
                    { $getField: { field: '$$a', input: '$unreadArticles' } },
                    null,
                  ],
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
                            $ifNull: [
                              { $getField: { field: '$$a', input: '$unreadArticles' } },
                              null,
                            ],
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
    // 8. Emit only the fields the caller reads.
    {
      $project: {
        _id: 1,
        user: 1,
        newsletters: 1,
        articles: 1,
        allArticleIds: 1,
      },
    },
  ];
}
