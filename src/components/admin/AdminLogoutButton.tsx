import { useNavigate } from 'react-router-dom';
import * as React from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/contexts/SessionContext';

export function AdminLogoutButton() {
  const navigate = useNavigate();
  const { reload } = useSession();
  const [pending, startTransition] = React.useTransition();

  const onClick = React.useCallback(() => {
    startTransition(() => {
      void (async () => {
        try {
          await apiFetch('/api/auth/logout', { method: 'POST' });
          await reload();
        } catch {
          // ignore
        }
        navigate('/login', { replace: true });
      })();
    });
  }, [navigate, reload]);

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={pending}>
      <LogOut className="h-3.5 w-3.5" />
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
