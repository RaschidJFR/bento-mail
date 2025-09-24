import { prop, getModelForClass, DocumentType, modelOptions } from '@typegoose/typegoose';
import { extractArticleDetails } from '@lib/ai-article-analyzer';
import { fetchHtmlContent, htmlToMarkdown, hash } from '@lib/utils';
import { clearModelInDevelopment } from './utils';

export interface IArticle {
  _id: string;
  content?: string;
  header: string;
  url?: string;
  date?: string;
  coverImg?: string;
  sourceName: string;
  summaries: {
    oneliner: string;
    overview: string;
    details: string;
  };
  lastError?: string;
}

function generateId(article: DocumentType<ArticleClass>) {
  if (!article.url && !article.content) {
    throw new Error('Either url or content must be provided');
  }
  return hash((article.url || article.content) as string);
}

@modelOptions({ options: { allowMixed: 0 } })
export class ArticleClass implements IArticle {
  @prop({ type: String, default: generateId })
  public _id: string = '';
  @prop({ default: '', type: String })
  public content?: string;
  @prop({ default: '', type: String })
  public header: string = '';
  @prop({ default: '', type: String })
  public url?: string;
  @prop({ default: '', type: String })
  public date?: string;
  @prop({ default: '', type: String })
  public coverImg?: string;
  @prop({ default: '', type: String })
  public sourceName: string = '';
  @prop({ default: {}, type: Object })
  public summaries: IArticle['summaries'] = {} as IArticle['summaries'];

  /**
   * Error message from the last processing attempt, if any.
   */
  @prop({ type: String })
  public lastError?: string;

  public async process(this: DocumentType<ArticleClass>) {
    const existing = (await ArticleModel.findById(this._id)) as Article;
    if ((existing && this.isModified()) || !existing) {
      throw new Error('You must save any changes to this object before processing');
    }
    // Prevent re-processing if summaries already exist
    if (existing.summaries?.oneliner && existing.summaries?.overview && existing.summaries?.details) {
      return;
    }

    try {
      if (existing.url) {
        const html = await fetchHtmlContent(existing.url);
        this.content = existing.content = htmlToMarkdown(html);
      }

      if (typeof existing.content !== 'string' || !existing.content.trim()) {
        throw new Error('Content is empty or invalid');
      }

      const data = await extractArticleDetails(existing.content);
      await this.set({
        ...data,
        coverImg: existing?.coverImg || data.coverImg,
        lastError: '',
      }).save();
    } catch (error: any) {
      this.lastError = error.message || String(error);
      await this.save();
      throw error;
    }
  }
}

clearModelInDevelopment('ArticleClass'!);
const ArticleModel = getModelForClass(ArticleClass);

export { ArticleModel as Article };
export type Article = DocumentType<ArticleClass>;
