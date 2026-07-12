import type { InferRootRow, MongoWhereFilter } from '@prisma-next/mongo-orm';
import { MongoFieldFilter } from '@prisma-next/mongo-query-ast/execution';
import type { Contract } from '@lib/prisma/contract.d';
import { db } from '@lib/prisma/db';
import { ObjectId } from 'mongodb';
import { User, IUser } from './user';
import { Newsletter, INewsletter } from './newsletter';
import { Article, IArticle } from './article';
import { Reaction } from './reaction';
import { applyInBatches } from '@lib/utils';

export enum ProcessingStagesEnum {
  COMPLETED_WITH_ERRORS = -2,
  ERROR = -1,
  NOT_STARTED = 0,
  PROCESSING_CONTENT = 1,
  CONTENT_PROCESSED = 2,
  SENT = 3,
}

export type IBundle = Omit<InferRootRow<Contract, 'Bundle'>, 'processingStage'> & {
  processingStage: ProcessingStagesEnum;
};

const bundles = db.orm.bundles;
const ormCreate = bundles.create.bind(bundles);

type BundleCreateInput = Parameters<typeof bundles.create>[0];

/**
 * Create a bundle. Verifies that the referenced user exists.
 */
async function create(input: BundleCreateInput) {
  const userId = String(input.user);
  const exists = await User.exists({ _id: userId });
  if (!exists) {
    throw new Error('User must exist to create a bundle');
  }
  return ormCreate({
    ...input,
    user: userId,
    processingStage: input.processingStage ?? ProcessingStagesEnum.NOT_STARTED,
  });
}

/**
 * Convenience method.
 * Short for `bundles.where(filter).select('_id').first()`
 */
async function exists(filter: MongoWhereFilter<Contract, 'Bundle'>): Promise<ObjectId | null> {
  const result = await bundles.where(filter).select('_id').first();
  return result?._id ? new ObjectId(String(result._id)) : null;
}

/**
 * Convenience method.
 * Short for `bundles.where({ _id: id }).first()`
 */
async function findById(id: ObjectId | string) {
  return bundles.where({ _id: String(id) }).first();
}

/**
 * Add one or more newsletter ids to the bundle identified by `_id`,
 * preventing duplicates.
 * @param _id - The bundle id
 * @param newsletterId - The newsletter id(s) to add
 * @returns The updated newsletter id array
 */
async function addNewsletter(_id: ObjectId | string, newsletterId: string | string[]): Promise<string[]> {
  return _addRefs(_id, 'newsletters', newsletterId);
}

/**
 * Add one or more article ids to the bundle identified by `_id`,
 * preventing duplicates.
 * @param _id - The bundle id
 * @param articleId - The article id(s) to add
 * @returns The updated article id array
 */
async function addArticle(_id: ObjectId | string, articleId: string | string[]): Promise<string[]> {
  return _addRefs(_id, 'articles', articleId);
}

/**
 * Add one or more references to the bundle identified by `_id`,
 * preventing duplicates.
 * @param _id - The bundle id
 * @param field - The reference field to update
 * @param refs - The reference id(s) to add
 * @returns The updated reference id array
 */
async function _addRefs(
  _id: ObjectId | string,
  field: keyof Pick<IBundle, 'newsletters' | 'articles'>,
  refs: string | string[],
): Promise<string[]> {
  const idsToAdd = Array.isArray(refs) ? refs : [refs];
  const bundleId = String(_id);
  const existing = await bundles.where({ _id: bundleId }).first();
  if (!existing) {
    throw new Error(`Bundle ${bundleId} not found`);
  }
  const existingIds = (existing[field]) || [];
  const merged = Array.from(new Set([...existingIds, ...idsToAdd]));
  await bundles.where({ _id: bundleId }).update({ [field]: merged });
  return merged;
}

/**
 * Find the next bundle to send for a given user whose content processing
 * has not yet started.
 * @param user - The user id or email
 * @returns The next bundle to send, or null if none found
 */
async function findNextToSend(user: string | ObjectId): Promise<IBundle | null> {
  let userId: string;
  if (typeof user === 'string' && !ObjectId.isValid(user)) {
    const matched = await User.findByEmail(user);
    if (!matched) return null;
    userId = String(matched._id);
  } else {
    userId = String(user);
  }

  const result = await bundles
    .where({ user: userId, processingStage: ProcessingStagesEnum.NOT_STARTED })
    .orderBy({ sendOn: 1, _id: -1 })
    .first();
  return (result as IBundle | null) ?? null;
}

/**
 * Process all newsletters in the bundle, extracting their articles.
 * @returns The number of newsletters that failed to extract
 */
async function unpackNewsletters(
  bundleId: ObjectId | string,
  { pulsecheck = () => {} }: { pulsecheck?: () => void } = {},
): Promise<number> {
  const id = String(bundleId);
  const bundle = await bundles.where({ _id: id }).first();
  if (!bundle) {
    throw new Error(`Bundle ${id} not found`);
  }
  return Newsletter.extractArticlesBatch((bundle.newsletters as string[]) || [], { pulsecheck });
}

/**
 * Process all newsletters and articles in the bundle, extracting their content.
 * Updates the `processingStage` field accordingly.
 *
 * Unpacks newsletters first (extracting their articles), then processes
 * every article in batches.
 * @returns The number of articles that failed to process or -1 on fatal error
 */
async function processContent(
  bundleId: ObjectId | string,
  { pulsecheck = () => {} }: { pulsecheck?: () => void } = {},
): Promise<number> {
  const id = String(bundleId);
  const existing = await bundles.where({ _id: id }).first();
  if (!existing) {
    throw new Error(`Bundle ${id} not found`);
  }

  if ((existing.processingStage || ProcessingStagesEnum.NOT_STARTED) !== ProcessingStagesEnum.NOT_STARTED) {
    console.warn(
      `[Bundle.processContent] Bundle ${id} has been previously processed (${
        ProcessingStagesEnum[existing.processingStage]
      }). Processing again...`,
    );
  }

  try {
    await bundles.where({ _id: id }).update({ processingStage: ProcessingStagesEnum.PROCESSING_CONTENT });
    let errorCount = 0;

    errorCount += await unpackNewsletters(id, { pulsecheck });

    // Re-fetch to pick up articles newly attached to newsletters
    const refreshed = await bundles.where({ _id: id }).first();
    const newsletterIds = ((refreshed?.newsletters as string[] | null) || []);
    const newsletters = (
      await Promise.all(newsletterIds.map((nid) => Newsletter.where({ _id: nid }).first()))
    ).filter(Boolean) as INewsletter[];

    const articleIds = Array.from(
      new Set([
        ...((refreshed?.articles as string[] | null) || []),
        ...newsletters.flatMap((nl) => (nl.articles as string[]) || []),
      ]),
    );

    await applyInBatches(
      articleIds,
      async (articleId) => {
        try {
          await Article.process(articleId);
        } catch (error: any) {
          console.error(`[Bundle.processContent] Error processing article ${articleId}:`);
          console.error(error.stack, '\n');
          errorCount++;
        }
      },
      { pulsecheck },
    );

    const finalStage =
      errorCount > 0 ? ProcessingStagesEnum.COMPLETED_WITH_ERRORS : ProcessingStagesEnum.CONTENT_PROCESSED;
    await bundles.where({ _id: id }).update({ processingStage: finalStage });
    errorCount && console.warn(`[Bundle.processContent] Completed with ${errorCount} errors in bundle ${id}`);
    return errorCount;
  } catch (error: any) {
    await bundles.where({ _id: id }).update({ processingStage: ProcessingStagesEnum.ERROR });
    console.error(`[Bundle.processContent] Error in bundle ${id}:`);
    console.error(error.stack, '\n');
    return -1;
  }
}

/**
 * Unwrap all article ids in a populated bundle, including those from
 * its newsletters.
 * @note Requires `articles` and `newsletters` (with their `articles`) to be populated.
 * @returns An array of article ids from the bundle and its newsletters.
 */
function unwrapArticleIds(bundle: {
  articles?: readonly (string | { _id: string })[] | null;
  newsletters?: readonly (string | INewsletter)[] | null;
}): string[] {
  if (!bundle.articles || !bundle.newsletters) {
    throw new Error('Please populate both articles and newsletters before calling unwrapArticleIds()');
  }
  const nlArticles: (string | { _id: string })[] = (bundle.newsletters as readonly (string | INewsletter)[])
    .flatMap((nl) => (typeof nl === 'string' ? [] : (nl.articles as readonly string[]) || []));
  const all = nlArticles.concat(bundle.articles as readonly (string | { _id: string })[]);
  return all.map((a) => (typeof a === 'string' ? a : a._id));
}

/**
 * Retrieve all articles in a bundle that the user has not reacted to yet.
 * This includes articles from newsletters in the bundle.
 */
async function getUnreadArticles(bundleId: ObjectId | string) {
  const id = String(bundleId);
  const bundle = await bundles.where({ _id: id }).first();
  if (!bundle) return null;

  const newsletterIds = (bundle.newsletters as string[] | null) || [];
  const newsletters = (
    await Promise.all(
      newsletterIds.map((nid) =>
        Newsletter.where({ _id: nid }).select('_id', 'articles', 'date', 'name', 'url', 'error').first(),
      ),
    )
  ).filter(Boolean) as INewsletter[];
  newsletters.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));

  const directArticleIds = (bundle.articles as string[] | null) || [];
  const allArticleIds = Array.from(
    new Set([...directArticleIds, ...newsletters.flatMap((n) => (n.articles as string[]) || [])]),
  );

  const reactions = allArticleIds.length
    ? await Reaction.where({ user: bundle.user })
        .where(MongoFieldFilter.in('article', allArticleIds))
        .select('article')
        .all()
        .toArray()
    : [];
  const reacted = new Set(reactions.map((r) => r.article));
  const unreadIds = allArticleIds.filter((aid) => !reacted.has(aid));

  const articleDocs = (
    await Promise.all(unreadIds.map((aid) => Article.where({ _id: aid }).first()))
  ).filter((a): a is IArticle => !!a && !a.lastError);
  const articleMap = new Map<string, IArticle>(articleDocs.map((a) => [a._id, a]));

  const finalArticles = directArticleIds
    .map((aid) => articleMap.get(aid))
    .filter((a): a is IArticle => !!a);
  const finalNewsletters = newsletters.map((n) => ({
    ...n,
    articles: ((n.articles as string[]) || [])
      .map((aid) => articleMap.get(aid))
      .filter((a): a is IArticle => !!a),
  }));

  return {
    _id: bundle._id,
    user: bundle.user,
    newsletters: finalNewsletters,
    articles: finalArticles,
    allArticleIds,
  };
}

export const Bundle = Object.assign(bundles, {
  create,
  exists,
  findById,
  addNewsletter,
  addArticle,
  findNextToSend,
  unpackNewsletters,
  processContent,
  unwrapArticleIds,
  getUnreadArticles,
  ProcessingStages: ProcessingStagesEnum,
});
