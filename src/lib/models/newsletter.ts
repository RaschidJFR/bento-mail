import { hash } from '@lib/utils.mjs';
import { prop, getModelForClass, modelOptions, Ref, pre } from '@typegoose/typegoose';
import type { DocumentType } from '@typegoose/typegoose';
import { Article, ArticleClass } from './article';
import { extractArticlesFromNewsletter } from '@lib/ai-article-analyzer';

export interface INewsletterProps {
  _id: string;
  content?: string;
  articles: Ref<ArticleClass>[];
  date?: string;
  name: string;
}

function generateId(this: DocumentType<NewsletterClass>) {
  if (!this.content) {
    throw new Error('Content is required to generate _id');
  }
  return hash(this.content as string);
}

@pre<NewsletterClass>('save', async function () {
  // Save any new Article instances in this.articles before saving the newsletter
  if (this.articles?.length > 0) {
    console.log(`Pre-save hook: Syncing related articles for newsletter ${this._id}...`);
    let cntNew = 0;
    let cntFound = 0;
    for (let i = 0; i < this.articles.length; i++) {
      const article = this.articles[i];
      if (article instanceof Article) {
        // Use _id (hash of content) to check for existing article
        const existing = await Article.findById(article._id);
        if (existing) {
          this.articles[i] = existing;
          cntFound++;
        } else if (article.isNew) {
          await article.save();
          cntNew++;
        }
      }
    }
    console.log(`${cntNew} new articles created. ${cntFound} existing articles linked.`);
  }
})
@modelOptions({ options: { allowMixed: 0 } })
export class NewsletterClass implements INewsletterProps {
  @prop({ default: generateId, type: String })
  public readonly _id!: string;
  @prop({ default: '', type: String })
  public content?: string;
  @prop({ ref: () => ArticleClass, type: [String], default: [] })
  public articles: Ref<ArticleClass>[] = [];
  @prop({ default: '', type: String })
  public date?: string;
  @prop({ default: '', type: String })
  public name: string = '';

  public async process(this: DocumentType<NewsletterClass>, text?: string) {
    if (this.articles && this.articles.length > 0) {
      return;
    }
    this.content = this.content || text || '';
    const data = await extractArticlesFromNewsletter(this.content);
    const articles = data.articles.map((a) => new Article(a));
    this.set({
      ...data,
      articles,
    });
  }
}

const NewsletterModel = getModelForClass(NewsletterClass);
export const Newsletter = NewsletterModel;
export type Newsletter = DocumentType<NewsletterClass>;

/**
 * Alias for `DocumentType<NewsletterClass>`
 */
export type DNewsletter = DocumentType<NewsletterClass>;
