import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import './globals.css';
import { BRAND } from '@/lib/brand';
import { ClientFinder } from '@/components/shared/ClientFinder';
import { TooltipProvider } from '@/components/shared/Tooltip';
import { UserMenu } from '@/components/shared/UserMenu';
import { USER_COOKIE_NAME, readUserSession } from '@/lib/google-auth';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: `${BRAND.name} — ${BRAND.tagline}.`,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sessionToken = cookies().get(USER_COOKIE_NAME)?.value;
  const session = await readUserSession(sessionToken);

  return (
    <html lang="en" className="dark h-dvh overflow-hidden">
      <body className="flex h-full min-h-0 flex-col overflow-hidden bg-bg text-text">
        <TooltipProvider>
        {session && (
          <header className="sticky top-0 z-30 w-full shrink-0 border-b border-border-strong bg-surface/85 shadow-[0_1px_0_0_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <div className="flex h-14 w-full items-center justify-between px-6 lg:px-8">
              <Link href="/dashboard" className="group flex items-center gap-2.5">
                <div className="relative h-7 w-7 overflow-hidden rounded-lg bg-gradient-to-br from-[#6366f1] via-[#7c5cf3] to-[#7c3aed] shadow-glow-soft transition group-hover:shadow-glow">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"
                  />
                  <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden>
                    <path
                      d="M 49 32 C 49 19 15 19 15 32 C 15 42 39 42 39 32 C 39 26 27 26 27 32"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="4.6"
                      strokeLinecap="round"
                    />
                    <circle cx="27" cy="32" r="2.4" fill="#ffffff" />
                  </svg>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] font-semibold tracking-tight text-text">{BRAND.name}</span>
                </div>
              </Link>
              <nav className="flex items-center gap-2 text-[13px]">
                <ClientFinder />
                <Link
                  href="/dashboard"
                  className="rounded-md px-3 py-1.5 text-text-dim transition hover:bg-surface hover:text-text">
                  Dashboard
                </Link>
                <Link
                  href="/admin"
                  className="rounded-md px-3 py-1.5 text-text-dim transition hover:bg-surface hover:text-text">
                  Admin
                </Link>
                <div className="ml-1 border-l border-border pl-2">
                  <UserMenu email={session.email} name={session.name} picture={session.picture} />
                </div>
              </nav>
            </div>
          </header>
        )}
        <main className="admin-main-fill mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col overflow-y-auto px-6 py-6 lg:py-5">
          {children}
        </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
