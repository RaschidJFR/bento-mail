import { NextRequest } from 'next/server';
import { Article, IArticle } from '@lib/models';
import { isArticleOrNewsletter } from '@lib/ai-article-analyzer';
import { htmlToMarkdown } from '@lib/utils';
import Scheduler, { JobNames } from '@services/worker';

interface RequestBody {
  content: string;
  url?: string;
  format: 'html' | 'text';
  force?: boolean;
  generateImage?: boolean;
}

export interface ResponseData {
  result: IArticle;
}

function validateRequestBody(body: RequestBody) {
  const { content, format } = body || ({} as any);

  if (typeof content !== 'string' || !content.trim()) {
    return { error: 'Missing or invalid "content" property in request body.' };
  }

  if (format !== 'html' && format !== 'text') {
    return { error: `Invalid "format" property in request body: ${format}` };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;

    // Validate request body
    const validationError = validateRequestBody(body);
    if (validationError) {
      return Response.json(validationError, { status: 400 });
    }

    const { content, format, force = false, generateImage = false, url } = body;

    // Convert HTML to Markdown if necessary
    const contentText = format === 'html' ? htmlToMarkdown(content) : content;

    // Derive article id from content/url
    const articleId = Article.generateId({ content: contentText, url: url ?? null });

    // Check for existing article with same id
    const existentArticle = await Article.findById(articleId);
    if (existentArticle) {
      return Response.json(
        { error: `An article with the same content already exists`, result: existentArticle, type: 'article' },
        { status: 409 }
      );
    }

    // Ensure content is an article
    const contentType = await isArticleOrNewsletter(contentText);
    if (contentType !== 'article') {
      return Response.json({ error: `Content is not an article (found: ${contentType}).` }, { status: 422 });
    }

    // Persist article
    const article = await Article.create({
      _id: articleId,
      content: contentText,
      url: url ?? null,
      header: '',
      sourceName: '',
      date: null,
      coverImg: null,
      summaries: null,
      linkedArticles: null,
      lastError: null,
    });

    // Trigger worker to process the article
    const id = article._id;
    const scheduler = await Scheduler();
    await scheduler
      .create(JobNames.Article.process, { id, force, generateImage })
      .schedule('now')
      .unique({ 'data.id': id }, { insertOnly: !force })
      .save();

    return Response.json({ result: article } as ResponseData, { status: 201 });
  } catch (error: any) {
    console.error(error.stack, '\n');
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
