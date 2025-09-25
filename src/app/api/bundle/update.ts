import { NextRequest } from 'next/server';
import { Bundle, IBundle } from '@lib/models';

export interface UpdateRequestBody {
  _id: string;
  reactions?: IBundle['reactions'];
}

export interface UpdateResponseData {
  result: IBundle;
}

function validateUpdateBody(body: Partial<UpdateRequestBody>) {
  const allowedKeys = ['_id', 'reactions'];
  const extraKeys = Object.keys(body).filter((key) => !allowedKeys.includes(key));
  if (extraKeys.length > 0) {
    return {
      error: `Unsupported key(s) in request body: ${extraKeys.join(', ')}. Only "_id" and "reactions" can be updated.`,
    };
  }
  if (typeof body._id !== 'string' || !body._id.trim()) {
    return { error: 'Missing or invalid "_id" property in request body.' };
  }
  if (
    !Array.isArray(body?.reactions) ||
    body.reactions?.some((r) => typeof r.article !== 'string' || !r.article.trim() || typeof r.reaction !== 'number')
  ) {
    return { error: 'Invalid "reactions" format.' };
  }
  return null;
}

export default async function (req: NextRequest) {
  try {
    const body = await req.json();
    const validationError = validateUpdateBody(body);
    if (validationError) {
      return Response.json(validationError, { status: 400 });
    }

    const { _id, reactions } = body;

    const bundle = (await Bundle.findById(_id)) as Bundle | null;
    if (!bundle) {
      return Response.json({ error: 'Bundle not found.' }, { status: 404 });
    }

    if (reactions !== undefined) {
      bundle.reactions = reactions;
    }

    await bundle.save();
    return Response.json({ result: bundle } as UpdateResponseData, { status: 200 });
  } catch (error: any) {
    console.error(error.stack, '\n');
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
