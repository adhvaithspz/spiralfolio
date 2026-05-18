import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { apiFetch } from '@/lib/api';

export function AdminLoginPage() {
  const [params] = useSearchParams();
  const fromParam = params.get('from');
  const redirectTo =
    typeof fromParam === 'string' && fromParam.startsWith('/') && !fromParam.startsWith('//')
      ? fromParam
      : '/admin';

  const [ready, setReady] = useState(false);
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await apiFetch('/api/admin/session');
      if (res.ok) {
        const d = (await res.json()) as { configured?: boolean; user?: { username: string } | null };
        setConfigured(d.configured !== false);
        if (d.user) {
          setAlreadyIn(true);
          setReady(true);
          return;
        }
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return null;
  if (alreadyIn) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-stretch justify-center gap-5 py-10">
      <div className="text-center">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-text-muted">SpiralFolio Admin</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">Sign in</h1>
        <p className="mt-1 text-[13px] text-text-muted">
          Operations console — pipeline events, Slack DM history, and call import audits.
        </p>
      </div>

      {!configured ? (
        <div className="rounded-lg border border-status-yellow/30 bg-status-yellow/5 p-4 text-[12.5px] leading-relaxed text-status-yellow">
          <div className="font-medium">Admin login is not configured.</div>
          <div className="mt-1 text-text-dim">
            Set{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">ADMIN_USERNAME</code>,{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">ADMIN_PASSWORD</code>, and{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">ADMIN_SESSION_SECRET</code>{' '}
            on the API server, then reload.
          </div>
        </div>
      ) : (
        <AdminLoginForm redirectTo={redirectTo} />
      )}
    </div>
  );
}
