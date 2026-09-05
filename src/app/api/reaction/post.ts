import { NextRequest } from 'next/server';
import { Reaction } from '@lib/models';
import { ReactionsEnum } from '@lib/models/enums';

export interface ReactionRequestBody {
  user: string;
  article: string;
  reaction: ReactionsEnum;
}

function validateReactionBody(body: ReactionRequestBody) {
  const { user, article, reaction } = body;
  if (typeof user !== 'string' || !user.trim()) {
    return { error: 'Missing or invalid "user" id.' };
  }
  if (typeof article !== 'string' || !article.trim()) {
    return { error: 'Missing or invalid "article" id.' };
  }
  if (!Object.values(ReactionsEnum).includes(reaction)) {
    return { error: 'Missing or invalid "reaction" value.' };
  }
  return null;
}

export default async function(req: NextRequest) {
  try {
    const body = await req.json();
    let { user, article, reaction }: ReactionRequestBody = body;
    user = user?.trim() || '';
    article = article?.trim() || '';

    const validationError = validateReactionBody({ user, article, reaction });
    if (validationError) {
      return Response.json(validationError, { status: 400 });
    }

    // Check if reaction already exists
    const existing = await Reaction.where({ user, article }).first();
    if (existing) {
      // Update reaction
      const updated = await Reaction.where({ user, article }).update({ reaction });
      return Response.json({ result: updated }, { status: 200 });
    }

    // Create new reaction
    const newReaction = await Reaction.create({ user, article, reaction, date: new Date() });
    return Response.json({ result: newReaction }, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
