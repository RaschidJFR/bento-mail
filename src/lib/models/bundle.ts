import { getModelForClass, prop } from '@typegoose/typegoose';
import type { Ref, ReturnModelType, DocumentType } from '@typegoose/typegoose';
import type { ObjectId } from 'mongoose';
import { UserClass, User } from './user';
import { Newsletter, NewsletterClass } from './newsletter';
import { Article, ArticleClass } from './article';

export interface IBundle {
  _id: ObjectId;
  sendOn?: Date;
  sent: boolean;
  user: Ref<UserClass>;
  newsletters?: Ref<NewsletterClass>[];
  articles?: Ref<ArticleClass>[];
}

export class BundleClass implements IBundle {
  public _id!: ObjectId;
  @prop({ type: Date })
  public sendOn?: Date;
  @prop({ type: Boolean, default: false })
  public sent!: boolean;
  @prop({ ref: () => UserClass, required: true })
  public user!: Ref<UserClass>;
  @prop({ ref: () => NewsletterClass, type: () => [String] })
  public newsletters?: Ref<NewsletterClass>[];
  @prop({ ref: () => ArticleClass, type: () => [String] })
  public articles?: Ref<ArticleClass>[];

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
          type === 'article' ? new Article({ _id }) : new Newsletter({ _id })
        );
        this.addElements(nls as any);
      } else if (elements[0] instanceof Newsletter || elements[0] instanceof Article) {
        const arr = elements as (Newsletter | Article)[];
        this.addElements(arr);
      }
    }
  }

  /**
   * Find the next bundle to send for a given user
   */
  public static findNextToSend(user: User): Promise<Bundle | null>;
  public static findNextToSend(email: string): Promise<Bundle | null>;
  public static findNextToSend(userId: ObjectId): Promise<Bundle | null>;
  public static async findNextToSend(this: ReturnModelType<typeof BundleClass>, user: User | ObjectId | string) {
    if (typeof user === 'string') {
      // Use aggregation pipeline to match user by email
      const [result] = await this.aggregate([
        {
          $lookup: {
            from: User.collection.name,
            localField: 'user',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        { $match: { 'user.email': user, sent: { $ne: true } } },
        { $sort: { sendOn: 1 } },
        { $limit: 1 },
      ]);
      return (result && BundleModel.hydrate(result)) || null;
    } else {
      return this.findOne({ user, sent: { $ne: true } }).sort({ sendOn: 1 });
    }
  }
}

const BundleModel = getModelForClass(BundleClass);
export { BundleModel as Bundle };
export type Bundle = DocumentType<BundleClass>;
