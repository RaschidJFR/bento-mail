import { NextRequest } from 'next/server';
import { Article } from '@lib/models/article';
import init, { JobNames } from '@services/worker';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: articleId } = await params;
  try {
    const article = await Article.findById(articleId);
    if (!article) {
      return Response.json({ error: 'Article not found' }, { status: 404 });
    }

    const { generateImage = false, force = false } = (await req.json?.()) || {};

    const agenda = await init();
    const job = await agenda
      .create(JobNames.Article.process, { id: articleId, force, generateImage })
      .schedule('now')
      .unique({ 'data.id': articleId }, { insertOnly: !force })
      .save();
    return Response.json({ result: job }, { status: 202 });
  } catch (error: any) {
    console.error(`[api] Error scheduling article.process for ${articleId}:`, error);
    return Response.json({ error: 'Failed to schedule job' }, { status: 500 });
  }
}
