
import { useNavigate } from 'react-router-dom';
import * as React from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { apiFetch } from '@/lib/api';

export function AdminLogoutButton() {
  const navigate = useNavigate();
  const [pending, startTransition] = React.useTransition();

  const onClick = React.useCallback(() => {
    startTransition(() => {
      void (async () => {
        try {
          await apiFetch('/api/admin/auth/logout', { method: 'POST' });
        } catch {
          // ignore — the user can also nuke the cookie manually
        }
        navigate('/admin/login', { replace: true });
      })();
    });
  }, [navigate]);

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={pending}>
      <LogOut className="h-3.5 w-3.5" />
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
