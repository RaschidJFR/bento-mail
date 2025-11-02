import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Bento Mail',
  description: 'Bundle Articles Preview',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <main className="container mx-auto py-6 px-0 md:px-6">{children}</main>
      </body>
    </html>
  );
}
