
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { apiFetch } from '@/lib/api';

export function UserMenu({
  email,
  name,
  picture,
}: {
  email: string;
  name: string;
  picture: string | null;
}) {
  const navigate = useNavigate();
  const { reload } = useSession();
  const [pending, startTransition] = React.useTransition();

  const onSignOut = React.useCallback(() => {
    startTransition(() => {
      void (async () => {
        try {
          await apiFetch('/api/auth/logout', { method: 'POST' });
        } catch {
          // ignore — the user can also clear cookies manually
        }
        await reload();
        navigate('/login?signedOut=1', { replace: true });
      })();
    });
  }, [navigate, reload]);

  const initial = (name || email).trim().charAt(0).toUpperCase() || '?';
  const displayName = name || email.split('@')[0];

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2 rounded-md px-2 py-1 text-[12.5px] text-text-dim sm:flex">
        {picture ? (
          <img
            src={picture}
            alt=""
            referrerPolicy="no-referrer"
            className="h-6 w-6 rounded-full border border-border"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
            {initial}
          </div>
        )}
        <span className="hidden font-medium text-text md:inline">{displayName}</span>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        disabled={pending}
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-text-dim transition hover:bg-surface hover:text-text disabled:opacity-60">
        <LogOut className="h-3.5 w-3.5" />
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
