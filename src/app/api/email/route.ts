import { NextRequest, NextResponse } from 'next/server';
import type { ParsedMail } from 'mailparser';
import { processNewEmail } from '@services/email';
import type { INewsletter } from '@lib/models';

/**
 * API route to process incoming emails.
 * Accepts a JSON payload representing the parsed email by mailparser.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed: ParsedMail = await req.json();
    const result: Partial<INewsletter> | null = await processNewEmail(parsed);
    if (result && 'content' in result) delete result.content;
    return NextResponse.json({ result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
