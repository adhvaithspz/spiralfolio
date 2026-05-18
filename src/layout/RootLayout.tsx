import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ClientFinder } from '@/components/shared/ClientFinder';
import { TooltipProvider } from '@/components/shared/Tooltip';
import { UserMenu } from '@/components/shared/UserMenu';
import { BRAND } from '@/lib/brand';
import { useSession } from '@/contexts/SessionContext';

const PUBLIC_PATHS = new Set([
  '/login',
  '/admin/login',
]);

export function RootLayout() {
  const { ready, user } = useSession();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[13px] text-text-muted">
        Loading…
      </div>
    );
  }

  const pub = PUBLIC_PATHS.has(location.pathname);
  if (!pub && !user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?from=${encodeURIComponent(from)}`} replace />;
  }

  return (
    <TooltipProvider>
      {user && !pub && (
        <header className="sticky top-0 z-30 w-full shrink-0 border-b border-border-strong bg-surface/85 shadow-[0_1px_0_0_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="flex h-14 w-full items-center justify-between px-6 lg:px-8">
            <Link to="/dashboard" className="group flex items-center gap-2.5">
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
                to="/dashboard"
                className="rounded-md px-3 py-1.5 text-text-dim transition hover:bg-surface hover:text-text">
                Dashboard
              </Link>
              <Link
                to="/admin"
                className="rounded-md px-3 py-1.5 text-text-dim transition hover:bg-surface hover:text-text">
                Admin
              </Link>
              <div className="ml-1 border-l border-border pl-2">
                <UserMenu email={user.email} name={user.name} picture={user.picture} />
              </div>
            </nav>
          </div>
        </header>
      )}
      <main className="admin-main-fill mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col overflow-y-auto px-6 py-6 lg:py-5">
        <Outlet />
      </main>
    </TooltipProvider>
  );
}
