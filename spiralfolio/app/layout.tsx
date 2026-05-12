import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: `${BRAND.name} — ${BRAND.tagline}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg text-text">
        <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="h-6 w-6 rounded-md bg-accent" aria-hidden />
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold tracking-tight text-text group-hover:text-text">
                  {BRAND.name}
                </span>
                <span className="hidden text-[11px] uppercase tracking-wider text-text-muted md:inline">
                  {BRAND.tagline}
                </span>
              </div>
            </Link>
            <nav className="flex items-center gap-1 text-[13px]">
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 text-text-dim hover:bg-surface hover:text-text transition">
                Dashboard
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
