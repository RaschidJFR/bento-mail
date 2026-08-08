import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import studio from '@mongoosejs/studio/backend/next';

const handler = studio(mongoose, {
  apiKey: process.env.MONGOOSE_STUDIO_API_KEY, // required for auth
  // enable local AI providers for Chat tab
  openaiApiKey: process.env.OPENAI_API_KEY,
});

type AppRouteMethod = (req: NextRequest) => Promise<NextResponse>;

async function runStudio(req: NextRequest): Promise<NextResponse> {
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  let body: Record<string, unknown> = {};

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      const contentType = req.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        body = (await req.json()) as Record<string, unknown>;
      } else {
        const text = await req.text();
        if (text) {
          body = Object.fromEntries(new URLSearchParams(text));
        }
      }
    } catch {
      body = {};
    }
  }

  let statusCode = 200;
  let responseBody: unknown = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    send(payload: unknown) {
      responseBody = payload;
      return this;
    },
    json(payload: unknown) {
      responseBody = payload;
      return this;
    },
  };

  await handler(
    {
      query,
      body,
      params: {},
      headers: {
        authorization: req.headers.get('authorization'),
      },
    },
    res
  );

  if (typeof responseBody === 'string') {
    return new NextResponse(responseBody, { status: statusCode });
  }

  return NextResponse.json(responseBody, { status: statusCode });
}

export const GET: AppRouteMethod = runStudio;
export const POST: AppRouteMethod = runStudio;
export const PUT: AppRouteMethod = runStudio;
export const PATCH: AppRouteMethod = runStudio;
export const DELETE: AppRouteMethod = runStudio;
export const OPTIONS: AppRouteMethod = runStudio;
export const HEAD: AppRouteMethod = runStudio;