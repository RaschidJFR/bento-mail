import { ObjectId } from 'mongodb';
import { COLLECTION_NAMES } from '@lib/prisma/contract';

export function populateUnreadArticles(bundleId: string) {
  return [
    {
      $match: {
        _id: ObjectId.createFromHexString(bundleId),
      },
    },
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
          {
            $unset: ['content'],
          },
          { $sort: { date: -1 } },
        ],
        as: 'newsletters',
      },
    },
    {
      $set: {
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
      },
    },
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
    {
      $set: {
        unreadArticles: {
          $setDifference: ['$allArticleIds', { $map: { input: '$reactions', in: '$$this.article' } }],
        },
      },
    },
    {
      $unset: ['reactions'],
    },
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
          {
            $unset: ['content'],
          }
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
    {
      $set: {
        articles: {
          $filter: {
            input: {
              $map: {
                input: '$articles',
                as: 'a',
                in: {
                  $ifNull: [{ $getField: { field: '$$a', input: '$unreadArticles' } }, null],
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
                            $ifNull: [{ $getField: { field: '$$a', input: '$unreadArticles' } }, null],
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
    {
      $unset: ['unreadArticles'],
    },
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
