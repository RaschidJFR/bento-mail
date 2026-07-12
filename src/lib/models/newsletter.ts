import type { InferRootRow, MongoWhereFilter } from '@prisma-next/mongo-orm';
import type { Contract } from '@lib/prisma/contract.d';
import { db } from '@lib/prisma/db';
import { Article, IArticle } from './article';
import {
  extractArticlesFromNewsletter,
  extractArticleDetails,
  classifyContent,
} from '@lib/ai-article-analyzer';
import { hash, applyInBatches } from '@lib/utils';

export type INewsletter = InferRootRow<Contract, 'Newsletter'>;

const newsletters = db.orm.newsletters;
const ormCreate = newsletters.create.bind(newsletters);

type NewsletterCreateInput = Parameters<typeof newsletters.create>[0];

/**
 * Generate a deterministic `_id` from `content`.
 */
function generateId(newsletter: Pick<INewsletter, 'content'>): string {
  if (!newsletter.content) {
    throw new Error('Content is required to generate _id');
  }
  return hash(newsletter.content);
}

/**
 * Verify every article id references an existing article.
 */
async function verifyArticlesExist(articleIds: readonly string[]): Promise<void> {
  for (const id of articleIds) {
    const existing = await Article.exists({ _id: id });
    if (!existing) {
      throw new Error(`Articles must be saved before being added to a newsletter.`);
    }
  }
}

/**
 * Create a newsletter. If `_id` is omitted, it is derived from `content`
 * via {@link generateId}. All referenced articles must already exist.
 */
async function create(input: NewsletterCreateInput) {
  const _id = input._id || generateId(input);
  if (input.articles?.length) {
    await verifyArticlesExist(input.articles);
  }
  return ormCreate({ ...input, _id });
}

/**
 * Convenience method.
 * Short for `newsletters.where(filter).select('_id').first()`
 */
async function exists(filter: MongoWhereFilter<Contract, 'Newsletter'>): Promise<string | null> {
  const result = await newsletters.where(filter).select('_id').first();
  return result?._id ?? null;
}

/**
 * Convenience method.
 * Short for `newsletters.where({ _id: id }).first()`
 */
async function findById(id: string) {
  return newsletters.where({ _id: id }).first();
}

/**
 * Return newsletters that contain the given article id.
 */
function findByArticle(articleId: IArticle['_id']) {
  return newsletters.where({ articles: articleId });
}

/**
 * Extract articles from the newsletter content, save them, and link them to
 * the newsletter identified by `_id`.
 *
 * If `articles` is already populated, the method does nothing.
 * If a previous extraction error exists, it will retry when `force` is set.
 * @returns Number of errors encountered while saving articles
 */
async function extractArticles(id: string, { force = false } = {}): Promise<number> {
  const existing = await newsletters.where({ _id: id }).first();
  if (!existing) {
    throw new Error(`Newsletter ${id} not found`);
  }

  const content = existing.content ?? '';
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Content is empty or invalid');
  }
  if (existing.articles?.length > 0 && !force) {
    console.warn(`Newsletter ${id} already has articles, skipping extraction.`);
    return 0;
  }
  if (existing.error && !force) {
    console.warn(
      `Newsletter %o previously failed. Skipping extraction. Error: (${existing.error})`,
      id
    );
    return 1;
  }

  try {
    console.log(`Extracting articles for newsletter %o...`, id);
    const classification = await classifyContent(content);
    console.log(
      `Classified newsletter %o as type: %o. Reason: %s`,
      id,
      classification.type,
      classification.reason
    );
    const contentType = classification.type;

    let name = existing.name || '';
    let date = existing.date || '';
    let dArticles: Partial<IArticle>[] = [];

    // If the content is classified as an article, we treat it as a single article newsletter.
    if (contentType === 'article') {
      const data = await extractArticleDetails(content, { skipVerify: true });
      name = data.sourceName || name; 
      date = data.date || date;
      dArticles = [data];
      console.log(`Identified 1 article in newsletter %o.`, id);
    } else if (contentType === 'newsletter') {
      const data = await extractArticlesFromNewsletter(content);
      // Use the newsletter's name and date if available, otherwise use the extracted values
      name = data.name || name;
      date = data.date || date;
      dArticles = data.articles;
      console.log(`Identified ${dArticles.length} articles in newsletter %o.`, id);
    } else {
      throw new Error('Content could not be classified as an article or newsletter.');
    }

    // Create articles (if not existing)
    const savedArticleIds: string[] = [];
    let errCount = 0;
    await applyInBatches(dArticles, async (a) => {
      try {
        const articleContent = a.content || content || '';
        const id = hash(articleContent);  // TODO: use article title for more stable id generation
        const existingArt = await Article.where({ _id: id }).first();
        if (!existingArt) {

          // TODO: use bulk write instead of individual creates for performance
          await Article.create({
            ...a,
            _id: id,
            content: articleContent,
            header: a.header || a.summaries?.oneliner || '',
            sourceName: a.sourceName || name || '',
            date: a.date || date || '',
            url: a.url ?? null,
            coverImg: a.coverImg ?? null,
            summaries: a.summaries ?? null,
            linkedArticles: a.linkedArticles ?? null,
            lastError: a.lastError ?? null,
          });
        } else {
          // TODO: evaluate if this patch is necessary, or if we should just skip existing articles. 
          // For now, we will patch missing fields.
          const patch: Partial<IArticle> = {};
          if (!existingArt.header) patch.header = a.header || a.summaries?.oneliner || '';
          if (!existingArt.sourceName) patch.sourceName = a.sourceName || name || '';
          if (!existingArt.date) patch.date = a.date || date || '';
          if (Object.keys(patch).length) {
            await Article.where({ _id: id }).update(patch);
          }
        }
        savedArticleIds.push(id);
      } catch (error: any) {
        console.error(`Failed to save article:`, error);
        errCount++;
      }
    });

    // Update newsletter with articles and clear any previous error
    await newsletters.where({ _id: id }).update({
      name,
      date,
      articles: savedArticleIds,
      error: '',
    });
    console.log(
      `Created ${savedArticleIds.length} articles for newsletter %o with ${errCount} errors.\n`,
      id
    );
    return errCount;
  } catch (error: any) {
    console.error(`Error extracting articles for newsletter %o:\n`, id, error, '\n');
    await newsletters.where({ _id: id }).update({ error: error.message || String(error) });
    throw error;
  }
}

/**
 * Extract articles for multiple newsletters.
 * @returns Number of errors encountered
 */
async function extractArticlesBatch(
  newsletterId: string[],
  { pulsecheck = () => {} }: { pulsecheck?: () => void } = {}
): Promise<number> {
  let errCount = 0;
  await applyInBatches(
    newsletterId || [],
    async (id) => {
      errCount += await extractArticles(id).catch((error: Error) => {
        console.error(`[extractArticles] Error processing newsletter ${id}:`);
        console.error(error.stack, '\n');
        return 1;
      });
    },
    { pulsecheck }
  );
  return errCount;
}

export const Newsletter = Object.assign(newsletters, {
  create,
  exists,
  findById,
  findByArticle,
  extractArticles,
  extractArticlesBatch,
  generateId,
});
