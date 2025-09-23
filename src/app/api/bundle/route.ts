import { NextRequest } from 'next/server';
import { Bundle, IBundle, User } from '@lib/models';

export interface RequestBody {
  email: string;
  newsletters: string[];
  articles: string[];
}

export interface ResponseData {
  result: IBundle;
}

function validateRequestBody(body: RequestBody) {
  const { email, newsletters, articles } = body;
  if (typeof email !== 'string' || !email.trim()) {
    return { error: 'Missing or invalid "email" property in request body.' };
  }
  const validNewsletters = Array.isArray(newsletters)
    ? newsletters.filter((id) => typeof id === 'string' && id.trim())
    : [];
  const validArticles = Array.isArray(articles) ? articles.filter((id) => typeof id === 'string' && id.trim()) : [];
  if (validNewsletters.length === 0 && validArticles.length === 0) {
    return { error: 'No valid newsletter or article IDs provided.' };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, newsletters, articles }: RequestBody = body;

    const validationError = validateRequestBody(body);
    if (validationError) {
      return Response.json(validationError, { status: 400 });
    }

    // Find user by email
    const user = await User.findOne({ email: email.trim() }).lean();
    if (!user) {
      return Response.json({ error: 'User not found.' }, { status: 404 });
    }

    // Find first unsent bundle with earliest sendOn date
    let bundle = await Bundle.findNextToSend(email);
    if (bundle) {
      if (newsletters?.length) {
        bundle.addNewsletter(newsletters);
      }
      if (articles?.length) {
        bundle.addArticle(articles);
      }
      await bundle.save();
      return Response.json({ result: bundle } as ResponseData, { status: 200 });
    } else {
      // Create new bundle
      bundle = new Bundle({
        user: user._id,
        newsletters: newsletters?.length ? newsletters : [],
        articles: articles?.length ? articles : [],
        sent: false,
      });
      await bundle.save();
      return Response.json({ result: bundle } as ResponseData, { status: 201 });
    }
  } catch (error: any) {
    console.error(error.stack, '\n');
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
