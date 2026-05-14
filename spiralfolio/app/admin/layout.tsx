import * as React from 'react';

/**
 * Admin section reuses the global header from RootLayout — no extra chrome
 * here. The signed-in user indicator and sign-out control live inside the
 * page content (e.g. the EventLogExplorer header row) so we don't end up
 * with two stacked navbars.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
