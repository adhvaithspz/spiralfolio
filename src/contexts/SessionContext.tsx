import * as React from 'react';
import { apiFetch } from '@/lib/api';

export type UserRole = 'admin' | 'viewer';
export type Viewer = { email: string; name: string; picture: string | null; role: UserRole };

type Ctx = {
  ready: boolean;
  user: Viewer | null;
  ssoConfigured: boolean;
  ssoGaps: string[];
  allowedDomains: string[];
  reload: () => Promise<void>;
};

const SessionContext = React.createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [user, setUser] = React.useState<Viewer | null>(null);
  const [ssoConfigured, setSsoConfigured] = React.useState(true);
  const [ssoGaps, setSsoGaps] = React.useState<string[]>([]);

  const [allowedDomains, setAllowedDomains] = React.useState<string[]>([]);

  const load = React.useCallback(async () => {
    const res = await apiFetch('/api/auth/session');
    if (!res.ok) {
      setUser(null);
      setSsoConfigured(true);
      setSsoGaps([]);
      setAllowedDomains([]);
      return;
    }
    const data = (await res.json()) as {
      configured: boolean;
      user: { email: string; name: string; picture: string | null; role?: UserRole } | null;
      gaps?: string[];
      allowedDomains?: string[];
    };
    setSsoConfigured(data.configured !== false);
    setSsoGaps(Array.isArray(data.gaps) ? data.gaps : []);
    setUser(data.user ? { ...data.user, role: data.user.role ?? 'viewer' } : null);
    setAllowedDomains(Array.isArray(data.allowedDomains) ? data.allowedDomains : []);
  }, []);

  React.useEffect(() => {
    void (async () => {
      await load();
      setReady(true);
    })();
  }, [load]);

  const value = React.useMemo(
    () => ({ ready, user, ssoConfigured, ssoGaps, allowedDomains, reload: load }),
    [ready, user, ssoConfigured, ssoGaps, allowedDomains, load]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const v = React.useContext(SessionContext);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
