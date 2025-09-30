import { prop, getModelForClass, DocumentType, modelOptions, index } from '@typegoose/typegoose';
import { extractArticleDetails, generateCoverImage } from '@lib/ai-article-analyzer';
import { fetchHtmlContent, htmlToMarkdown, hash } from '@lib/utils';
import { clearModelInDevelopment } from './utils';
import { Reaction, ReactionsEnum } from './reaction';
import { Types } from 'mongoose';

export interface IArticle {
  _id: string;
  content?: string;
  header: string;
  url?: string;
  date?: string;
  coverImg?: string;
  sourceName?: string;
  summaries?: {
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
@index({ lastError: 1, sourceName: 1, date: -1, _id: 1 }) // Optimized for fetching articles for a bundle
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

  public isProcessed(this: DocumentType<ArticleClass>) {
    return ArticleModel.isProcessed(this);
  }

  public static isProcessed(article: IArticle) {
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
  public async process(this: DocumentType<ArticleClass>, { force = false } = {}) {
    let existing = (await ArticleModel.findById(this._id)) as Article;
    if ((existing && this.isModified()) || !existing) {
      throw new Error('You must save any changes to this object before processing');
    }
    // Prevent re-processing if summaries already exist
    if (this.isProcessed() && !force) {
      return;
    }

    try {
      try {
        if (existing.url) {
          const html = await fetchHtmlContent(existing.url);
          this.content = existing.content = htmlToMarkdown(html);
        }
      } catch (fetchError: any) {
        console.warn(`Failed to fetch HTML content for article ${this._id}: ${fetchError.message}`);
        console.warn('Using existing content for processing');
      }

      if (typeof existing.content !== 'string' || !existing.content.trim()) {
        throw new Error('Content is empty or invalid');
      }

      const data = await extractArticleDetails(existing.content);

      let coverImg = existing?.coverImg || data.coverImg || '';
      if (!coverImg) {
        console.warn(`No cover image found for article %o. Attempting to generate.`, this._id);
        try {
          const { oneliner, overview, details } = data.summaries!;
          coverImg = await generateCoverImage(`Oneliner: ${oneliner}\nOverview: ${overview}\nDetails: ${details}`);
        } catch (err: any) {
          console.warn(`Failed to generate cover image for article %o:`, this._id, err.message);
          console.warn(err);
        }
      }

      // Check again if it was processed in the meantime
      existing = (await ArticleModel.findById(this._id)) as Article;
      if (existing.isProcessed() && !force) {
        console.warn(`Article %o was processed in the meantime, skipping update`, this._id);
        // Update props and unmark as modified
        this.set(existing.toObject());
        this.modifiedPaths().forEach((path) => this.unmarkModified(path));
        return;
      }

      await this.set({
        ...data,
        coverImg,
        lastError: '',
      }).save();
    } catch (error: any) {
      this.lastError = error.message || String(error);
      await this.save();
      throw error;
    }
  }

  /**
   * Add or update a user's reaction to this article.
   * Each user can have only one reaction per article.
   */
  public async addReaction(this: DocumentType<ArticleClass>, reaction: ReactionsEnum, userId: string | Types.ObjectId) {
    const existingReaction = await Reaction.findOne({ user: userId, article: this._id });
    if (existingReaction) {
      if (existingReaction.reaction === reaction) {
        // No change needed
        return;
      }
      existingReaction.reaction = reaction;
      await existingReaction.save();
    } else {
      const newReaction = new Reaction({
        user: userId,
        article: this._id,
        reaction: reaction,
      });
      await newReaction.save();
    }
  }
}

clearModelInDevelopment('ArticleClass'!);
const ArticleModel = getModelForClass(ArticleClass);

export { ArticleModel as Article };
export type Article = DocumentType<ArticleClass>;
