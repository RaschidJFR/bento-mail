import { hash, applyInBatches } from '@lib/utils';
import { prop, getModelForClass, modelOptions, Ref, pre, index, queryMethod, getName } from '@typegoose/typegoose';
import type { DocumentType, ReturnModelType, types } from '@typegoose/typegoose';
import { Article, ArticleClass, IArticle } from './article';
import { extractArticlesFromNewsletter } from '@lib/ai-article-analyzer';
import { clearModelInDevelopment } from './utils';

export interface INewsletter {
  _id: string;
  content: string;
  articles: Ref<ArticleClass>[];
  date?: string;
  name?: string;
  error?: string;
}

function generateId(this: DocumentType<NewsletterClass>) {
  if (!this.content) {
    throw new Error('Content is required to generate _id');
  }
  return hash(this.content as string);
}

function findByArticle(this: types.QueryHelperThis<typeof NewsletterClass, QueryHelpers>, id: IArticle['_id']) {
  return this.find({ articles: id });
}

interface QueryHelpers {
  findByArticle: types.AsQueryMethod<typeof findByArticle>;
}

@pre<NewsletterClass>('save', async function () {
  // Save any new Article instances in this.articles before saving the newsletter
  if (this.articles?.length > 0) {
    for (let i = 0; i < this.articles.length; i++) {
      const article = this.articles[i];
      let id = article instanceof Article ? article._id : article;

      const existing = await Article.exists({ _id: id });
      if (existing) {
        this.articles[i] = existing._id;
      } else {
        throw new Error(`Articles must be saved before being added to a newsletter.`);
      }
    }
  }
})
@modelOptions({ options: { allowMixed: 0 } })
@index({ error: 1 }, { sparse: true })
@index({ date: -1 })
@queryMethod(findByArticle)
export class NewsletterClass implements INewsletter {
  @prop({ default: generateId, type: String })
  public readonly _id!: string;
  @prop({ default: '', type: String })
  public content: string = '';
  @prop({ ref: () => ArticleClass, type: [String], default: [] })
  public articles: Ref<ArticleClass>[] = [];
  @prop({ default: '', type: String })
  public date?: string;
  @prop({ default: '', type: String })
  public name?: string = '';

  /**
   * Error message from the last extraction attempt, if any.
   */
  @prop({ type: String })
  public error?: string;

  /**
   * Extract articles from the newsletter content, save them, and link them to this newsletter.
   *
   * If `articles` is already populated, the method does nothing.
   * If a previous extraction error exists, it will retry.
   * @return Number of errors encountered while saving articles
   */
  public async extractArticles(this: Newsletter, { force = false } = {}): Promise<number> {
    // Ensure the article is pristine
    const existing = (await Newsletter.findById(this._id)) as Newsletter | null;
    let content = existing?.content || this.content || '';
    if ((existing && this.isModified()) || !existing) {
      throw new Error('You must save any changes to this object before processing');
    }
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Content is empty or invalid');
    }
    if (existing?.articles?.length > 0 && !force) {
      console.warn(`Newsletter ${this._id} already has articles, skipping extraction.`);
      return 0;
    }
    if (existing.error && !force) {
      console.warn(`Newsletter %o previously failed. Skipping extraction. Error: (${existing.error})`, this._id);
      return 1;
    }

    try {
      console.log(`Extracting articles for newsletter %o...`, this._id);
      const data = await extractArticlesFromNewsletter(content);

      // Save articles and link them to this newsletter
      let errCount = 0;
      const articles: Article[] = [];
      await applyInBatches(data.articles, async (a) => {
        try {
          let art = new Article(a);
          const artExists = await Article.findById({ _id: art._id });
          art = artExists || art;
          art.sourceName = art.sourceName || data.name || existing.name || '';
          art.date = art.date || data.date || existing.date || '';
          await art.save();
          articles.push(art);
        } catch (error: any) {
          console.error(`Failed to save article:`);
          console.error(error.stack, '\n');
          errCount++;
        }
      });

      // Update newsletter with articles and clear any previous error
      existing.set({ ...data, articles, error: '' });
      await this.set(existing.toObject()).save();
      console.log(
        `Extracted and saved ${articles.length} articles for newsletter %o with ${errCount} errors.\n`,
        this._id
      );
      return errCount;
    } catch (error: any) {
      console.error(`Error extracting articles for newsletter %o`, this._id);
      console.error(error.stack, '\n');

      // Save the error message
      await this.set({ error: error.message || String(error) }).save();
      throw error;
    }
  }

  /**
   * Extract articles for multiple newsletters, saving and linking their articles.
   * @returns Number of errors encountered
   */
  public static async extractArticles(newsletters: Newsletter[], opts?: { pulsecheck?: () => {} }): Promise<number>;
  public static async extractArticles(newsletterIds: string[], opts?: { pulsecheck?: () => {} }): Promise<number>;
  public static async extractArticles(
    this: ReturnModelType<typeof NewsletterClass>,
    newsletters: DocumentType<NewsletterClass>[] | string[],
    { pulsecheck = () => {} } = {}
  ) {
    // Convert all elements to Class instances
    const items = (newsletters || []).map((nl) =>
      typeof nl === 'string' ? NewsletterModel.hydrate({ _id: nl }) : (nl as Newsletter)
    );

    // Process newsletters
    let errCount = 0;
    await applyInBatches(
      items,
      async (nl) => {
        errCount += await nl.extractArticles().catch((error: Error) => {
          console.error(`[extractArticles] Error processing newsletter ${nl._id}:`);
          console.error(error.stack, '\n');
          return 1;
        });
      },
      { pulsecheck }
    );
    return errCount;
  }
}
clearModelInDevelopment(getName(NewsletterClass));
const NewsletterModel = getModelForClass<typeof NewsletterClass, QueryHelpers>(NewsletterClass);

export const Newsletter = NewsletterModel;
export type Newsletter = DocumentType<NewsletterClass>;
