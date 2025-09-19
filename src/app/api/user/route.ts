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
    let user = await User.findOne({ email }).select('_id');
    if (user) {
      return Response.json({ error: 'User already exists.', result: user }, { status: 409 });
    }

    // Create new user
    user = new User({ email });
    await user.save();
    return Response.json({ result: user }, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
