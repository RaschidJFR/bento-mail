import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@lib/auth';
import { headers } from 'next/headers';
import { GoogleLoginButton } from './components/GoogleLoginButton';
import type { IBundle } from '@lib/models/types';

export default async function HomePage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  // Get callbackURL from search params if present
  const callbackURL = (await searchParams)?.callbackURL;

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Welcome to Bento Mail</h1>
            <div className="text-center space-y-1 pb-2">
              <p className="text-sm font-medium text-foreground">This service is currently by invitation only</p>
              <p className="text-xs text-muted-foreground">
                If you&apos;ve been invited, sign in with your Google account below
              </p>
            </div>
          </div>
          <GoogleLoginButton callbackURL={callbackURL} />
        </div>
      </main>
    );
  }

  let error = '';

  // Fetch the bundle for the authenticated user
  // Forward the headers from the incoming request to authenticate the API call
  const res = await fetch(`${process.env.APP_URL}/api/bundle`, {
    headers: headersList,
  });

  if (!res.ok) {
    console.error('Failed to fetch bundle', res.statusText);
    error = 'Failed to fetch bundle: ' + res.statusText;
  } else {
    const { result: bundle }: { result: IBundle | null } = await res.json();
    if (!bundle) {
      console.warn('No bundle found for this user');
      error = 'No bundle found for this user';
    } else if (bundle?._id) {
      // If callbackURL is present, redirect there, else to bundle
      if (callbackURL) {
        redirect(callbackURL);
      } else {
        redirect(`/bundle/${String(bundle._id)}`);
      }
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-4">Welcome to Bento Mail</h1>
      {!!error ? <p className="text-gray-500">{error}</p> : <p className="text-gray-500">Redirecting...</p>}
    </main>
  );
}
