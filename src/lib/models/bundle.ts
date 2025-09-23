import { getModelForClass, getName, pre, prop } from '@typegoose/typegoose';
import type { Ref, ReturnModelType, DocumentType } from '@typegoose/typegoose';
import type { ObjectId } from 'mongoose';
import { UserClass, User } from './user';
import { Newsletter, NewsletterClass } from './newsletter';
import { Article, ArticleClass } from './article';
import { clearModelInDevelopment } from './utils';
import { applyInBatches } from '@lib/utils';
import { warn } from 'console';

export interface IBundle {
  _id: ObjectId;
  sendOn?: Date;
  user: Ref<UserClass>;
  newsletters?: Ref<NewsletterClass>[];
  articles?: Ref<ArticleClass>[];
  processingStage: ProcessingStagesEnum;
}

enum ProcessingStagesEnum {
  COMPLETED_WITH_ERRORS = -2,
  ERROR = -1,
  NOT_STARTED = 0,
  PROCESSING_CONTENT = 1,
  CONTENT_PROCESSED = 2,
  SENT = 3,
}

@pre<BundleClass>('save', async function () {
  const user = this.user as User;
  if (this.isNew && user.isNew !== false) {
    const exists = await User.exists({ _id: user._id }).lean();
    if (!exists) {
      throw new Error('User must exist to create a bundle');
    }
  }
})
export class BundleClass implements IBundle {
  public _id!: ObjectId;
  @prop({ type: Date })
  public sendOn?: Date;
  @prop({ ref: () => UserClass, required: true })
  public user!: Ref<UserClass>;
  @prop({ ref: () => NewsletterClass, type: () => [String] })
  public newsletters?: Ref<NewsletterClass>[];
  @prop({ ref: () => ArticleClass, type: () => [String] })
  public articles?: Ref<ArticleClass>[];
  @prop({ type: Number, enum: ProcessingStagesEnum, default: ProcessingStagesEnum.NOT_STARTED })
  public processingStage: ProcessingStagesEnum = ProcessingStagesEnum.NOT_STARTED;

  /**
   * Adds one or more newsletter IDs or Newsletter documents to the bundle, preventing duplicates.
   */
  public addElements(this: DocumentType<BundleClass>, elements: (Article | Newsletter)[]) {
    if (elements.length > 0) {
      elements.forEach((item) => {
        if (!(item as any)._id) {
          throw new Error('Element must have an _id');
        }
        if (item instanceof Newsletter) {
          this.newsletters = !this.newsletters?.length ? [] : this.newsletters;
          if (!this.newsletters.includes(item._id)) {
            this.newsletters.push(item._id);
          }
        } else if (item instanceof Article) {
          this.articles = !this.articles?.length ? [] : this.articles;
          if (!this.articles.includes(item._id)) {
            this.articles.push(item._id);
          }
        }
      });
    }
  }

  /**
   * Add a newsletter to the bundle.
   * If the newsletter is already in the bundle, it won't be added again.
   * @param newsletter - Newsletter document(s) or newsletter ID(s)
   * @return The updated newsletter array
   */
  public addNewsletter(newsletter: Newsletter): Ref<NewsletterClass>[];
  public addNewsletter(newsletters: Newsletter[]): Ref<NewsletterClass>[];
  public addNewsletter(newsletterId: string): Ref<NewsletterClass>[];
  public addNewsletter(newsletterIds: string[]): Ref<NewsletterClass>[];
  public addNewsletter(this: DocumentType<BundleClass>, newsletters: Newsletter | Newsletter[] | string | string[]) {
    this.addNewsletterOrArticle(newsletters, 'newsletter');
    return this.newsletters;
  }

  /**
   * Add an article to the bundle.
   * If the article is already in the bundle, it won't be added again.
   * @param article - Article(s) document or article ID(s)
   * @return The updated articles array
   */
  public addArticle(article: Article): Ref<ArticleClass>[];
  public addArticle(articles: Article[]): Ref<ArticleClass>[];
  public addArticle(articleId: string): Ref<ArticleClass>[];
  public addArticle(articleIds: string[]): Ref<ArticleClass>[];
  public addArticle(this: DocumentType<BundleClass>, articles: Article | Article[] | string | string[]) {
    this.addNewsletterOrArticle(articles, 'article');
    return this.articles;
  }

  addNewsletterOrArticle(
    this: DocumentType<BundleClass>,
    elements: Newsletter | Newsletter[] | Article | Article[] | string | string[],
    type: 'newsletter' | 'article'
  ) {
    if (!Array.isArray(elements)) {
      elements = [elements as any];
    }

    if (Array.isArray(elements)) {
      if (typeof elements[0] === 'string') {
        const nls = (elements as string[]).map((_id) =>
          type === 'article' ? Article.hydrate({ _id }) : Newsletter.hydrate({ _id })
        );
        this.addElements(nls as any);
      } else if (elements[0] instanceof Newsletter || elements[0] instanceof Article) {
        const arr = elements as (Newsletter | Article)[];
        this.addElements(arr);
      }
    }
  }

  /**
   * Find the next bundle to send for a given user whose content processing has not yet started.
   */
  public static findNextToSend(user: User): Promise<Bundle | null>;
  public static findNextToSend(email: string): Promise<Bundle | null>;
  public static findNextToSend(userId: ObjectId): Promise<Bundle | null>;
  public static async findNextToSend(this: ReturnModelType<typeof BundleClass>, user: User | ObjectId | string) {
    if (typeof user === 'string') {
      // Use aggregation pipeline to match user by email
      const [result] = await this.aggregate([
        {
          $match: {
            $or: [
              { processingStage: { $eq: ProcessingStagesEnum.NOT_STARTED } },
              { processingStage: { $exists: false } },
            ],
          },
        },
        {
          $lookup: {
            from: User.collection.name,
            localField: 'user',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        { $match: { 'user.email': user } },
        { $sort: { sendOn: 1, _id: -1 } },
        { $limit: 1 },
      ]);
      return (result && BundleModel.hydrate(result)) || null;
    } else {
      return this.findOne({
        user,
        $or: [{ processingStage: { $eq: ProcessingStagesEnum.NOT_STARTED } }, { processingStage: { $exists: false } }],
      }).sort({ sendOn: 1, _id: -1 });
    }
  }

  /**
   * Process all newsletters in this bundle, extracting their articles.
   * @param pulsecheck - Optional callback to report progress after every batch
   * @returns The number of articles that failed to extract
   */
  public async _unpackNewsletters(this: DocumentType<BundleClass>, { pulsecheck = () => {} } = {}) {
    // Ensure the bundle is saved and not modified
    const bundle = (await BundleModel.findById(this._id)) as Bundle;
    if (!bundle || this.isModified()) {
      throw new Error('Please save bundle before processing its elements');
    }

    // Convert all elements to Class instances
    const newsletters = (bundle?.newsletters || []).map((o) =>
      typeof o === 'string' ? Newsletter.hydrate({ _id: o }) : (o as Newsletter)
    );

    const erroCount = await Newsletter.extractArticles(newsletters, { pulsecheck } as any);
    return erroCount;
  }

  /**
   * Process all newsletters and articles in this bundle, extracting their content.
   * Updates the `processingStage` field accordingly.
   *
   * Under the hood, this method first calls `_unpackNewsletters()` to extract their articles,
   * then processes all articles in batches.
   * @param param1 - Optional callback to report progress after every batch
   * @returns The number of articles that failed to process or -1 on fatal error
   */
  public async processContent(this: DocumentType<BundleClass>, { pulsecheck = () => {} } = {}) {
    // Ensure the bundle is saved and not modified
    const existing = (await BundleModel.findById(this._id).populate('articles newsletters')) as Bundle;
    if (!existing || this.isModified()) {
      throw new Error('Please save bundle before processing its elements');
    }

    if ((existing.processingStage || ProcessingStagesEnum.NOT_STARTED) != ProcessingStagesEnum.NOT_STARTED) {
      warn(
        `[Bundle.processArticles] Bundle ${this._id} has been previously processed (${
          ProcessingStagesEnum[existing.processingStage]
        }). Processing again...`
      );
    }

    try {
      this.processingStage = ProcessingStagesEnum.PROCESSING_CONTENT;
      await this.save();
      let errorCount = 0;

      // First, unpack all newsletters to extract their articles
      errorCount += await existing._unpackNewsletters({ pulsecheck });
      await existing.populate([
        {
          path: 'newsletters',
          populate: { path: 'articles' },
        },
        {
          path: 'articles',
        },
      ]);

      const newsletters = (existing.newsletters || []) as Newsletter[];
      const articles = newsletters.map((nl) => nl.articles).flat() as Article[];
      articles.push(...((existing.articles as Article[]) || []));

      // Process articles in batches
      await applyInBatches(
        articles,
        async (article) => {
          try {
            await article.process();
          } catch (error: any) {
            console.error(`[Bundle.processArticles] Error processing article ${article._id}:`);
            console.error(error.stack, '\n');
            errorCount++;
          }
        },
        { pulsecheck }
      );

      this.processingStage =
        errorCount > 0 ? ProcessingStagesEnum.COMPLETED_WITH_ERRORS : ProcessingStagesEnum.CONTENT_PROCESSED;
      await this.save();
      errorCount && console.warn(`[Bundle.processArticles] Completed with ${errorCount} errors in bundle ${this._id}`);
      return errorCount;
    } catch (error: any) {
      this.processingStage = ProcessingStagesEnum.ERROR;
      await this.save();
      console.error(`[Bundle.processArticles] Error in bundle ${this._id}:`);
      console.error(error.stack, '\n');
      return -1;
    }
  }
  public static ProcessingStages = ProcessingStagesEnum;
}

clearModelInDevelopment(getName(BundleClass));
const BundleModel = getModelForClass(BundleClass);

export { BundleModel as Bundle };
export type Bundle = DocumentType<BundleClass>;
export namespace Bundle {
  export type ProcessingStages = ProcessingStagesEnum;
}
