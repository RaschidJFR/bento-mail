import crypto from 'crypto';
import { prop, pre, getModelForClass, DocumentType, modelOptions, Ref, isDocument } from '@typegoose/typegoose';
import { Article, ArticleClass } from './article';
import { extractArticlesFromNewsletter } from '@lib/ai-article-analyzer';

function getHash(textContent: string) {
  if (!textContent || typeof textContent !== 'string' || !textContent.trim()) {
    throw new Error('Content must be a non-empty string: ' + textContent);
  }
  textContent = textContent.trim();
  const hash = crypto.createHash('sha256').update(textContent).digest('hex');
  return hash;
}

export interface INewsletterProps {
  _id: string;
  content?: string;
  articles: Ref<ArticleClass>[];
  date?: string;
  name: string;
}

@pre<NewsletterClass>('save', async function () {
  try {
    console.log(`Pre-save hook: Processing and saving articles for newsletter ${this._id}...`);
    const promises =
      this.articles
        ?.filter((a) => !!(isDocument(a) && a.isNew))
        .map((a) => isDocument(a) && a.process().then(() => a.save())) || [];
    await Promise.all(promises);
  } catch (error) {
    console.error('Error saving articles in newsletter pre-save hook:', error);
    throw error;
  }
})
@modelOptions({ options: { allowMixed: 0 } })
class NewsletterClass implements INewsletterProps {
  @prop({
    default: function (this: DocumentType<NewsletterClass>) {
      return getHash(this.content as string);
    },
  })
  public readonly _id!: string;
  @prop()
  public content?: string;
  @prop({ ref: () => ArticleClass, type: () => String, default: [] })
  public articles: Ref<ArticleClass>[] = [];
  @prop()
  public date?: string;
  @prop()
  public name: string = '';

  public async process(this: DocumentType<NewsletterClass>, text?: string) {
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
export const NewsLetter = NewsletterModel;
