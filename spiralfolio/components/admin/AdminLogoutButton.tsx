'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/shared/Button';

export function AdminLogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const onClick = React.useCallback(() => {
    startTransition(async () => {
      try {
        await fetch('/api/admin/auth/logout', { method: 'POST' });
      } catch {
        // ignore — the user can also nuke the cookie manually
      }
      router.replace('/admin/login');
      router.refresh();
    });
  }, [router]);

  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={pending}>
      <LogOut className="h-3.5 w-3.5" />
      {pending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
