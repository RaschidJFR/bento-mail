import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@lib/auth';
import { headers } from 'next/headers';
import { GoogleLoginButton } from './components/GoogleLoginButton';
import type { IBundle } from '@lib/models/types';

export default async function HomePage() {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Welcome to Bento Mail</h1>
            <p className="text-gray-600">Sign in with your Google account to continue</p>
          </div>
          <GoogleLoginButton />
        </div>
      </main>
    );
  }

  const email = session.user.email;
  let error = '';

  if (!email) {
    error = 'No email found in session';
  } else {
    // Fetch the bundle for the given email and redirect
    const res = await fetch(`${process.env.APP_URL}/api/bundle?userEmail=${encodeURIComponent(email)}`);
    if (!res.ok) {
      console.error('Failed to fetch bundle', res.statusText);
      error = 'Failed to fetch bundle: ' + res.statusText;
    } else {
      const { result: bundle }: { result: IBundle | null } = await res.json();
      if (!bundle) {
        console.warn('No bundle found for this user');
        error = 'No bundle found for this user';
      } else if (bundle?._id) {
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
