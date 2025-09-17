import crypto from 'crypto';
import { prop, getModelForClass, DocumentType, modelOptions } from '@typegoose/typegoose';
import { extractArticleDetails } from '@lib/ai-article-analyzer';
import { fetchHtmlContent, htmlToMarkdown } from '@lib/utils.mjs';

function hash(textContent: string) {
  if (!textContent || typeof textContent !== 'string' || !textContent.trim()) {
    throw new Error('Content must be a non-empty string: ' + textContent);
  }
  textContent = textContent.trim();
  const hash = crypto.createHash('sha256').update(textContent).digest('hex');
  return hash;
}
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

@modelOptions({ options: { allowMixed: 0 } })
export class ArticleClass implements IArticleProps {
  @prop({
    default: function (this: DocumentType<ArticleClass>) {
      return hash((this.url || this.content) as string);
    },
  })
  public _id!: string;
  @prop({ default: '' })
  public content?: string = '';
  @prop({ default: '' })
  public header: string = '';
  @prop({ default: '' })
  public url?: string = '';
  @prop()
  public date?: string;
  @prop({ default: '' })
  public coverImg?: string = '';
  @prop({ default: '' })
  public sourceName: string = '';
  @prop({ default: {} })
  public summaries: IArticleProps['summaries'] = {} as IArticleProps['summaries'];

  public async process(this: DocumentType<ArticleClass>) {
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
