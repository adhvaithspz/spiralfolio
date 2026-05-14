import { redirect } from 'next/navigation';
import { getAdminSession, isAdminConfigured } from '@/lib/admin-auth';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

export const dynamic = 'force-dynamic';

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  const session = getAdminSession();
  if (session) {
    redirect(searchParams?.from || '/admin');
  }
  const configured = isAdminConfigured();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-stretch justify-center gap-5 py-10">
      <div className="text-center">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          SpiralFolio Admin
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">Sign in</h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Operations console — pipeline events, Slack DM history, and call import audits.
        </p>
      </div>

      {!configured ? (
        <div className="rounded-lg border border-status-yellow/30 bg-status-yellow/5 p-4 text-[12.5px] leading-relaxed text-status-yellow">
          <div className="font-medium">Admin login is not configured.</div>
          <div className="mt-1 text-text-dim">
            Set <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">ADMIN_USERNAME</code>,{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">ADMIN_PASSWORD</code>, and{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">ADMIN_SESSION_SECRET</code> in
            your environment, then reload this page.
          </div>
        </div>
      ) : (
        <AdminLoginForm redirectTo={searchParams?.from || '/admin'} />
      )}
    </div>
  );
}
