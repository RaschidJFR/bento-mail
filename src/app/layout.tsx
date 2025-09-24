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
        <main className="container mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}
