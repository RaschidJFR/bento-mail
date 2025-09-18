import { prop, getModelForClass, DocumentType, modelOptions, pre } from '@typegoose/typegoose';
import { extractArticleDetails } from '@lib/ai-article-analyzer';
import { fetchHtmlContent, htmlToMarkdown, hash } from '@lib/utils.mjs';

export interface IArticleProps {
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
}

function generateId(article: DocumentType<ArticleClass>) {
  if (!article.url && !article.content) {
    throw new Error('Either url or content must be provided');
  }
  return hash((article.url || article.content) as string);
}

@modelOptions({ options: { allowMixed: 0 } })
export class ArticleClass implements IArticleProps {
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
  public summaries: IArticleProps['summaries'] = {} as IArticleProps['summaries'];

  public async process(this: DocumentType<ArticleClass>) {
    // Prevent re-processing if summaries already exist
    if (this.summaries?.oneliner && this.summaries?.overview && this.summaries?.details) {
      return;
    }

    if (this.url) {
      const html = await fetchHtmlContent(this.url);
      this.content = htmlToMarkdown(html);
    }

    if (!this.content) throw new Error('Article has not content to process');
    const data = await extractArticleDetails(this.content);
    this.set({
      ...data,
      coverImg: this.coverImg || data.coverImg,
    });
  }
}

const ArticleModel = getModelForClass(ArticleClass);
export const Article = ArticleModel;
