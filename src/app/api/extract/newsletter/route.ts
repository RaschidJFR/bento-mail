import { NextRequest } from 'next/server';
import { Newsletter, Article } from '@lib/models';
import { isArticleOrNewsletter } from '@lib/ai-article-analyzer';
import { htmlToMarkdown } from '@lib/utils.mjs';

interface RequestBody {
  content: string;
  userEmail: string;
  format: 'html' | 'text';
}

interface ResponseBody {
  data: {
    contentType?: 'article' | 'newsletter';
    id: string;
  };
}

function validateRequestBody(body: RequestBody) {
  const { content, userEmail, format } = body;

  if (typeof content !== 'string' || !content.trim()) {
    return { error: 'Missing or invalid "content" property in request body.' };
  }

  if (typeof userEmail !== 'string' || !userEmail.trim()) {
    return { error: 'Missing or invalid "userEmail" property in request body.' };
  }

  if (format !== 'html' && format !== 'text') {
    return { error: 'Missing or invalid "userEmail" property in request body.' };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const responseBody: ResponseBody = { data: { id: '' } };
    const { content, userEmail, format }: RequestBody = body;
    console.log(`Received content from '${userEmail}'...`);

    const validationError = validateRequestBody(body);
    if (validationError) {
      return Response.json(validationError, { status: 400 });
    }

    const contentText = format == 'html' ? htmlToMarkdown(content) : content;
    const article = new Article({ content: contentText });
    const newsletter = new Newsletter({ content: contentText });

    const existent = await findExistent([article, newsletter]);
    if (existent) {
      console.log(`An article or newsletter already exists with id ${existent._id}`);
      return Response.json({ error: `An article or newsletter with the same content already exists` }, { status: 409 });
    }

    const contentType = await isArticleOrNewsletter(contentText);
    if (contentType == 'article') {
      responseBody.data.id = article._id;
      responseBody.data.contentType = 'article';
      console.log('New Article instantiated with id:', article._id);
      enqueueSaveTask(article);
    } else if (contentType == 'newsletter') {
      responseBody.data.id = newsletter._id;
      responseBody.data.contentType = 'newsletter';
      console.log('New Newsletter instantiated with id:', newsletter._id);
      enqueueSaveTask(newsletter);
    } else {
      return Response.json({ error: 'Could not determine if content is an article or a newsletter.' }, { status: 400 });
    }

    return Response.json(responseBody, { status: 202 });
  } catch (error: any) {
    console.error(error);
    console.error(error.stack);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function enqueueSaveTask(item: any) {
  console.log('Processing item content...');
  await item.process();
  await item.save();
  console.log('Item processed and saved!');
}

async function findExistent(items: any[]) {
  const foundObjects = await Promise.all(items.map((it) => it.model().exists({ _id: it._id })));
  return foundObjects.find((o) => !!o);
}
