import React from 'react';
import { redirect } from 'next/navigation';
import type { IBundle } from '@lib/models/types';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const email = (await searchParams)?.email;
  let error = '';

  if (!email || Array.isArray(email)) {
    error = 'No valid email parameter provided';
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
