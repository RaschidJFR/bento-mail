import { NextRequest } from 'next/server';
import { User } from '@lib/models';

export interface RequestBody {
  email: string;
}

function validateRequestBody(body: RequestBody) {
  const { email } = body;
  if (typeof email !== 'string' || !email.trim()) {
    return { error: 'Missing or invalid "email" property in request body.' };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { email }: RequestBody = body;
    email = email?.trim() || '';

    const validationError = validateRequestBody(body);
    if (validationError) {
      return Response.json(validationError, { status: 400 });
    }

    // Check if user already exists
    const exists = await User.findByEmail(email).select('_id').first();
    if (exists) {
      return Response.json({ error: 'User already exists.', result: exists }, { status: 409 });
    }

    // Create new user
    const user = await User.create({ email, name: null, aliasEmail: null, image: null });
    return Response.json({ result: user }, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
