import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { Bundle, IBundle } from '@lib/models';
import { auth } from '@lib/auth';

export interface ResponseData {
  result: IBundle | null;
}

/**
 * Get the next bundle for the authenticated user
 */
export default async function (_req: NextRequest) {
  try {
    // Get session from authenticated user
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList,
    });

    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = session.user.email;

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
