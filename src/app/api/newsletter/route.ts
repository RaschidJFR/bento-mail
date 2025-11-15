import { NextRequest } from 'next/server';
import { Newsletter, INewsletter } from '@lib/models';
import { isArticleOrNewsletter } from '@lib/ai-article-analyzer';
import { htmlToMarkdown } from '@lib/utils';
import Scheduler, { JobNames } from '@services/worker';

interface RequestBody {
  content: string;
  format: 'html' | 'text';
}

export interface ResponseData {
  result: INewsletter;
}

function validateRequestBody(body: RequestBody) {
  const { content, format } = body;

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
    const body = await req.json();

    // Validate request body
    const validationError = validateRequestBody(body);
    if (validationError) {
      return Response.json(validationError, { status: 400 });
    }

    const { content, format }: RequestBody = body;
    console.log(`Received content for newsletter...`);

    // Convert HTML to Markdown if necessary
    const contentText = format == 'html' ? htmlToMarkdown(content) : content;
    const newsletter = new Newsletter({ content: contentText }) as Newsletter;

    // Check for existing newsletter with the same ID
    const existentNewsletter = await Newsletter.exists({ _id: newsletter._id }).lean();
    if (existentNewsletter) {
      console.warn(`A newsletter already exists with id %o`, existentNewsletter._id);
      return Response.json(
        { error: `A newsletter with the same content already exists`, result: existentNewsletter, type: 'newsletter' },
        { status: 409 }
      );
    }

    // Determine if content is a newsletter and save
    const contentType = await isArticleOrNewsletter(contentText);
    // A result of 'article' is acceptable here since some newsletters contain a single article
    if (contentType == 'newsletter' || contentType == 'article') {
      console.log('Creating new Newsletter with id: %o', newsletter._id);
      await newsletter.save();
    } else {
      console.warn('Content is not a newsletter nor an article: ', contentType);
      return Response.json(
        { error: `Content is not a newsletter nor an article (found: ${contentType}).` },
        { status: 422 }
      );
    }

    // Trigger worker to process the bundle
    const id = newsletter._id;
    const scheduler = await Scheduler();
    await scheduler
      .create(JobNames.Newsletter.processArticles, { id })
      .schedule('now')
      .unique({ 'data.id': id }, { insertOnly: true }) // Prevent duplicate jobs
      .save();

    return Response.json({ result: newsletter } as ResponseData, { status: 201 });
  } catch (error: any) {
    console.error(error.stack, '\n');
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
