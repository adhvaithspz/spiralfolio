'use client';

import * as React from 'react';

/**
 * Locks <main> to overflow:hidden while this shell is mounted so Tailwind’s
 * overflow-y:auto on <main> cannot create a second page-level scroll. Only the
 * inner log pane (overflow-y:auto) should scroll. Cleanup restores the prior
 * inline style when leaving /admin.
 */
export function AdminEventLogShell({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const main = document.querySelector('main.admin-main-fill');
    if (!(main instanceof HTMLElement)) return;
    const prev = main.style.overflow;
    main.style.overflow = 'hidden';
    return () => {
      main.style.overflow = prev;
    };
  }, []);

  return (
    <div className="admin-shell-lock -mx-6 flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden lg:-mx-8">
      <div className="flex h-full min-h-0 w-full flex-1 flex-col px-6 lg:px-8">{children}</div>
    </div>
  );
}
