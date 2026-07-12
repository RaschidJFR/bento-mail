import type { InferRootRow, MongoWhereFilter } from '@prisma-next/mongo-orm';
import type { Contract } from '@lib/prisma/contract.d';
import { db } from '@lib/prisma/db';
import { extractArticleDetails, generateCoverImage } from '@lib/ai-article-analyzer';
import { fetchHtmlContent, htmlToMarkdown, hash } from '@lib/utils';

export type IArticle = InferRootRow<Contract, 'Article'>;

const articles = db.orm.articles;
const ormCreate = articles.create.bind(articles);

type ArticleCreateInput = Parameters<typeof articles.create>[0];

/**
 * Generate a deterministic `_id` from `url` or `content`.
 */
function generateId(article: Pick<IArticle, 'url' | 'content'>): string {
  if (!article.url && !article.content) {
    throw new Error('Either url or content must be provided');
  }
  return hash((article.url || article.content) as string);
}

/**
 * Create an article. If `_id` is omitted, it is derived from `url`/`content`
 * via {@link generateId}.
 */
function create(input: ArticleCreateInput) {
  const _id = input._id ?? generateId(input);
  return ormCreate({ ...input, _id });
}

/**
 * Convenience method.
 * Short for `articles.where(filter).select('_id').first()`
 */
async function exists(filter: MongoWhereFilter<Contract, 'Article'>): Promise<string | null> {
  const result = await articles.where(filter).select('_id').first();
  return result?._id ?? null;
}

/**
 * Convenience method.
 * Short for `articles.where({ _id: id }).first()`
 */
async function findById(id: string) {
  return articles.where({ _id: id }).first();
}

/**
 * Check if an article has been fully processed.
 */
function isProcessed(article: Pick<IArticle, 'summaries' | 'lastError'>): boolean {
  return (
    !!article.summaries?.oneliner &&
    !!article.summaries?.overview &&
    !!article.summaries?.details &&
    !article.lastError
  );
}

/**
 * Process the article to extract details and summaries.
 *
 * If `summaries` already exist, the method will not re-process the article.
 * If a previous processing attempt failed, it will retry.
 */
async function process(_id: string, { force = false, generateImage = false } = {}): Promise<void> {
  let existing = await articles.where({ _id }).first();
  if (!existing) {
    throw new Error(`Article ${_id} not found`);
  }
  // Prevent re-processing if summaries already exist
  if (isProcessed(existing) && !force) {
    return;
  }

  try {
    let content = existing.content ?? '';
    try {
      if (existing.url) {
        const html = await fetchHtmlContent(existing.url);
        content = htmlToMarkdown(html);
      }
    } catch (fetchError: any) {
      console.warn(`Failed to fetch HTML content for article ${_id}: ${fetchError.message}`);
      console.warn('Using existing content for processing');
    }

    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Content is empty or invalid');
    }

    const data = await extractArticleDetails(content);

    let coverImg = existing?.coverImg || data.coverImg || '';
    if (!coverImg && generateImage) {
      console.warn(`No cover image found for article %o. Attempting to generate.`, _id);
      try {
        const { oneliner, overview, details } = data.summaries!;
        coverImg = await generateCoverImage(`Oneliner: ${oneliner}\nOverview: ${overview}\nDetails: ${details}`);
      } catch (err: any) {
        console.warn(`Failed to generate cover image for article %o:`, _id, err.message);
        console.warn(err);
      }
    }

    // Check again if it was processed in the meantime
    existing = await articles.where({ _id }).first();
    if (existing && isProcessed(existing) && !force) {
      console.warn(`Article %o was processed in the meantime, skipping update`, _id);
      return;
    }

    await articles.where({ _id }).update({
      content,
      ...data,
      coverImg,
      lastError: '',
    });
  } catch (error: any) {
    await articles.where({ _id }).update({ lastError: error.message || String(error) });
    throw error;
  }
}

export const Article = Object.assign(articles, { create, exists, findById, isProcessed, process, generateId });
