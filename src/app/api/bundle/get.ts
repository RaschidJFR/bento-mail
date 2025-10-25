import { NextRequest } from 'next/server';
import { Bundle, IBundle, User } from '@lib/models';

export interface ResponseData {
  result: IBundle | null;
}

/**
 * Get the next bundle for a user by email
 */
export default async function (req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get('userEmail');
    if (!userEmail || typeof userEmail !== 'string' || !userEmail.trim()) {
      return Response.json({ error: 'Missing or invalid userEmail parameter.' }, { status: 400 });
    }

    // Find user by email
    const user = await User.findOne({ email: userEmail.trim() }).lean();
    if (!user) {
      return Response.json({ error: 'User not found.' }, { status: 404 });
    }

    // Find first unsent bundle with earliest sendOn date
    const bundle = await Bundle.findNextToSend(userEmail);
    if (!bundle) {
      return Response.json({ result: null } as ResponseData, { status: 200 });
    }
    return Response.json({ result: bundle } as ResponseData, { status: 200 });
  } catch (error: any) {
    console.error(error.stack, '\n');
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
