import type { ReactNode } from 'react';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <link rel="icon" href="/favicon.svg" />
      <body>{children}</body>
    </html>
  );
}
