'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { IBundle } from '@lib/models/types';

function HomePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!email) {
      setError('No email parameter provided in the URL');
      return;
    }
    // Fetch the bundle for the given email and redirect
    fetch(`/api/bundle?userEmail=${encodeURIComponent(email)}`).then(async (res) => {
      if (!res.ok) {
        console.error('Failed to fetch bundle', res.statusText);
        setError('Failed to fetch bundle: ' + res.statusText);
        return;
      }
      const { result: bundle }: { result: IBundle } = await res.json();
      if (!bundle) {
        console.warn('No bundle found for this user');
        setError('No bundle found for this user');
        return;
      }
      const bundleId = String(bundle._id);
      router.replace(`/bundle/${bundleId}`);
    });
  }, [email, router]);

  return <main>{!!error && <p className="text-gray-500">{error}</p>}</main>;
}

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-4">Welcome to Bento Mail</h1>
      <Suspense fallback={<p className="text-gray-500">Redirecting to your bundle...</p>}>
        <HomePageContent />
      </Suspense>
    </main>
  );
}
