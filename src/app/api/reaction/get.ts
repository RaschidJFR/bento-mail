import { MongoFieldFilter } from '@prisma/orm-mongo/query-ast/execution';
import { NextRequest } from 'next/server';
import { Bundle, User, Article, Reaction, Newsletter } from '@lib/models';

export default async function (req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user')?.trim() || '';
    const articleId = searchParams.get('article')?.trim() || '';
    const bundleId = searchParams.get('bundle')?.trim() || '';

    if (bundleId) {
      return getByBundle(bundleId);
    } else {
      return getByUserAndArticle(userId, articleId);
    }
  } catch (error: any) {
    console.error(error.stack);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function getByBundle(bundleId: string) {
  // Find bundle and get all article IDs
  const bundle = await Bundle.findById(bundleId);
  if (!bundle) {
    return Response.json({ error: 'Bundle not found' }, { status: 404 });
  }

  const newsletterIds = bundle.newsletters || [];
  const newsletters = await Newsletter.where(MongoFieldFilter.in('_id', newsletterIds))
    .select('articles')
    .all();

  const articleIds = Bundle.unwrapArticleIds({
    articles: bundle.articles || [],
    newsletters,
  });

  const reactions = await Reaction.where({ user: String(bundle.user) })
    .where(MongoFieldFilter.in('article', articleIds))
    .all()
    .toArray();

  return Response.json({ result: reactions }, { status: 200 });
}

async function getByUserAndArticle(userId: string, articleId: string) {
  if (!userId) {
    return Response.json({ error: 'Missing or invalid user id' }, { status: 400 });
  } else if (!(await User.exists({ _id: userId }))) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  if (!articleId) {
    return Response.json({ error: 'Missing or invalid article id' }, { status: 400 });
  } else if (!(await Article.exists({ _id: articleId }))) {
    return Response.json({ error: 'Article not found' }, { status: 404 });
  }

  // Find reaction by user and article
  const reactions = await Reaction.where({ user: userId, article: articleId }).all().toArray();
  return Response.json({ result: reactions }, { status: 200 });
}
