
import { useNavigate } from 'react-router-dom';
import * as React from 'react';
import { Button } from '@/components/shared/Button';
import { apiFetch } from '@/lib/api';

export function AdminLoginForm({ redirectTo }: { redirectTo: string }) {
  const navigate = useNavigate();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const onSubmit = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setPending(true);
      try {
        const res = await apiFetch('/api/admin/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error || `Login failed (${res.status})`);
          return;
        }
        navigate(redirectTo, { replace: true });
      } catch (err) {
        setError((err as Error).message ?? 'Login failed');
      } finally {
        setPending(false);
      }
    },
    [username, password, redirectTo, navigate],
  );

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface/60 p-5 shadow-card-hover">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-text-dim">
          Username
        </span>
        <input
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="h-10 rounded-md border border-border bg-bg px-3 text-[13px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-text-dim">
          Password
        </span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="h-10 rounded-md border border-border bg-bg px-3 text-[13px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </label>

      {error && (
        <div className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-[12.5px] text-status-red">
          {error}
        </div>
      )}

      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
