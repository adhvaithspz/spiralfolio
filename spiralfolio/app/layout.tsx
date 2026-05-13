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
        <header className="sticky top-0 z-30 border-b border-border bg-bg/70 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
            <Link href="/dashboard" className="group flex items-center gap-2.5">
              <div className="relative h-7 w-7 overflow-hidden rounded-lg bg-gradient-to-br from-accent via-indigo-500 to-violet-600 shadow-glow-soft">
                <span className="absolute inset-0 bg-dot-grid opacity-40" aria-hidden />
                <span className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/70" aria-hidden />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[14px] font-semibold tracking-tight text-text">
                  {BRAND.name}
                </span>
                <span className="hidden text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-muted md:inline">
                  {BRAND.tagline}
                </span>
              </div>
            </Link>
            <nav className="flex items-center gap-1 text-[13px]">
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 text-text-dim transition hover:bg-surface hover:text-text">
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
