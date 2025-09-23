import { NextRequest } from 'next/server';
import { Newsletter, Article, IArticle, INewsletter } from '@lib/models';
import { isArticleOrNewsletter } from '@lib/ai-article-analyzer';
import { htmlToMarkdown } from '@lib/utils';

interface RequestBody {
  content: string;
  format: 'html' | 'text';
}

export interface ResponseData {
  type: 'article' | 'newsletter';
  result: IArticle | INewsletter;
}

function validateRequestBody(body: RequestBody) {
  const { content, format } = body;

  if (typeof content !== 'string' || !content.trim()) {
    return { error: 'Missing or invalid "content" property in request body.' };
  }

  if (format !== 'html' && format !== 'text') {
    return { error: 'Missing or invalid "userEmail" property in request body.' };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const responseBody = {} as ResponseData;
    const { content, format }: RequestBody = body;
    console.log(`Received content for newsletter/article...`);

    const validationError = validateRequestBody(body);
    if (validationError) {
      return Response.json(validationError, { status: 400 });
    }

    const contentText = format == 'html' ? htmlToMarkdown(content) : content;
    const article = new Article({ content: contentText }) as Article;
    const newsletter = new Newsletter({ content: contentText }) as Newsletter;

    const [existentArticle, existentNewsletter] = await findExistent([article, newsletter]);
    if (existentArticle) {
      console.warn(`An article already exists with id ${existentArticle._id}`);
      return Response.json(
        { error: `An article with the same content already exists`, result: existentArticle, type: 'article' },
        { status: 409 }
      );
    } else if (existentNewsletter) {
      console.warn(`A newsletter already exists with id ${existentNewsletter._id}`);
      return Response.json(
        { error: `An article with the same content already exists`, result: existentNewsletter, type: 'newsletter' },
        { status: 409 }
      );
    }

    const contentType = await isArticleOrNewsletter(contentText);
    if (contentType == 'article') {
      responseBody.result = article;
      responseBody.type = 'article';
      console.log('Creating new Article with id:', article._id);
      await article.save();
    } else if (contentType == 'newsletter') {
      responseBody.result = newsletter;
      responseBody.type = 'newsletter';
      console.log('Creating new Newsletter with id:', newsletter._id);
      await newsletter.save();
    } else {
      return Response.json({ error: 'Could not determine if content is an article or a newsletter.' }, { status: 400 });
    }

    return Response.json(responseBody, { status: 201 });
  } catch (error: any) {
    console.error(error.stack, '\n');
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function findExistent(items: (Article | Newsletter)[]) {
  // @ts-ignore
  return Promise.all(items.map((it) => it.model().findById(it._id).lean()));
}
