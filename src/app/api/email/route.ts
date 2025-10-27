import { NextRequest, NextResponse } from 'next/server';
import type { ParsedMail } from 'mailparser';
import { processNewEmail } from '@services/email';
import dns from 'node:dns/promises';

/**
 * API route to process incoming emails.
 * Accepts a JSON payload representing the parsed email by mailparser.
 * Verifies webhook source using reverse DNS lookup as per forwardemail.net docs.
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      const isValidSource = await verifyWebhookSource(req);
      if (!isValidSource) {
        return NextResponse.json({ error: 'Unauthorized source' }, { status: 403 });
      }
    }
    const parsed: ParsedMail = await req.json();
    processNewEmail(parsed);
    return NextResponse.json({ status: 'ok' }, { status: 200 }); // forwardemail.net expects code 200
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * See https://forwardemail.net/en/faq#do-you-support-webhooks
 */
async function verifyWebhookSource(req: NextRequest): Promise<boolean> {
  try {
    const allowedHosts = process.env.ALLOWED_EMAIL_HOSTS?.trim()
      ? process.env.ALLOWED_EMAIL_HOSTS.split(',').map((h) => h.trim())
      : [];

    if (allowedHosts.length === 0) {
      console.warn('No allowed email hosts configured, skipping verification');
      return true; // Skip verification if no hosts are configured
    }

    // Get remote IP address (works if behind a proxy that sets x-forwarded-for)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const remoteIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '';
    if (!remoteIp) {
      return false;
    }

    // Reverse DNS lookup
    const hostnames = await dns.reverse(remoteIp);

    const isAllowed = hostnames.some((h) => allowedHosts.includes(h));
    if (!isAllowed) {
      return false;
    }
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}
