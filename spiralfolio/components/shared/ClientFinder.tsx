'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, ArrowRight, AlertTriangle, AlertOctagon, Command } from 'lucide-react';

type Lite = {
  id: string;
  name: string;
  engagement: string | null;
  pmName: string | null;
  adName: string | null;
  status: string | null;
};

const STATUS_DOT: Record<string, string> = {
  'on-track': 'bg-status-green',
  'at-risk': 'bg-status-yellow',
  blocked: 'bg-status-red',
  complete: 'bg-status-grey',
};

function isMacLike() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/**
 * Subsequence fuzzy match: returns a score (lower is better) and the indexes
 * of matched characters in the haystack so we can highlight them. Returns null
 * when not all query chars are present in order.
 */
function fuzzy(query: string, haystack: string): { score: number; indexes: number[] } | null {
  if (!query) return { score: 0, indexes: [] };
  const q = query.toLowerCase();
  const h = haystack.toLowerCase();
  let qi = 0;
  let lastIdx = -1;
  let gapPenalty = 0;
  const indexes: number[] = [];
  for (let i = 0; i < h.length && qi < q.length; i++) {
    if (h[i] === q[qi]) {
      indexes.push(i);
      if (lastIdx >= 0) gapPenalty += i - lastIdx - 1;
      lastIdx = i;
      qi++;
    }
  }
  if (qi < q.length) return null;
  // Bonus: starts-with + word-boundary matches
  const prefixBonus = h.startsWith(q) ? -20 : 0;
  const wordBonus = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(h) ? -10 : 0;
  return { score: gapPenalty + prefixBonus + wordBonus + h.length * 0.1, indexes };
}

function highlight(text: string, indexes: number[]): React.ReactNode {
  if (indexes.length === 0) return text;
  const set = new Set(indexes);
  return (
    <>
      {Array.from(text).map((ch, i) =>
        set.has(i) ? (
          <span key={i} className="text-accent">
            {ch}
          </span>
        ) : (
          ch
        ),
      )}
    </>
  );
}

export function ClientFinder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Lite[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [mac, setMac] = useState(false);

  useEffect(() => {
    setMac(isMacLike());
  }, []);

  // Global keyboard: ⌘K / Ctrl+K opens, '/' opens (when not typing in another input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === '/' && !inField && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lazy-fetch the lightweight client list the first time the palette opens.
  useEffect(() => {
    if (!open || clients !== null) return;
    setLoading(true);
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => {
        const lite: Lite[] = (data.clients ?? []).map((c: Record<string, unknown>) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
          engagement: (c.engagement as string | null) ?? null,
          pmName: (c.pmName as string | null) ?? null,
          adName: (c.adName as string | null) ?? null,
          status: (c.status as string | null) ?? 'on-track',
        }));
        setClients(lite);
      })
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [open, clients]);

  // Reset query and active row when reopened
  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!clients) return [];
    if (!q.trim()) {
      return clients.slice(0, 30).map(c => ({ client: c, indexes: [] as number[] }));
    }
    const scored = clients
      .map(c => {
        const blob = `${c.name} ${c.engagement ?? ''} ${c.pmName ?? ''} ${c.adName ?? ''}`;
        const m = fuzzy(q, blob);
        if (!m) return null;
        const nameMatch = fuzzy(q, c.name);
        return {
          client: c,
          score: m.score - (nameMatch ? 5 : 0),
          indexes: nameMatch?.indexes ?? [],
        };
      })
      .filter((x): x is { client: Lite; score: number; indexes: number[] } => x !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 30);
    return scored;
  }, [clients, q]);

  // Reset active when results change
  useEffect(() => {
    setActive(0);
  }, [q]);

  // Auto-scroll active row into view
  useEffect(() => {
    if (!listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const navigate = (id: string) => {
    setOpen(false);
    router.push(`/clients/${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, Math.max(0, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[active];
      if (target) navigate(target.client.id);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Search clients"
          className="group flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[12px] text-text-muted transition hover:border-border-strong hover:text-text">
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search clients</span>
          <span className="ml-1 hidden items-center gap-0.5 rounded border border-border bg-bg/50 px-1.5 py-0.5 text-[10px] font-medium text-text-muted sm:flex">
            {mac ? (
              <>
                <Command className="h-2.5 w-2.5" />K
              </>
            ) : (
              'Ctrl K'
            )}
          </span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md" />
        <Dialog.Content
          className="fixed left-1/2 top-[18%] z-50 w-[92vw] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50"
          onKeyDown={onKeyDown}>
          <Dialog.Title className="sr-only">Find a client</Dialog.Title>

          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-text-muted" />
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search clients, engagements, PM, AD…"
              className="flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-muted"
              autoComplete="off"
              autoFocus
            />
            <kbd className="hidden items-center gap-1 rounded border border-border bg-bg/50 px-1.5 py-0.5 text-[10px] text-text-muted sm:flex">
              esc
            </kbd>
          </div>

          <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
            {loading && clients === null ? (
              <SkeletonRows />
            ) : results.length === 0 ? (
              <EmptyState query={q} hasClients={!!clients?.length} />
            ) : (
              <ul className="py-1">
                {results.map((r, i) => (
                  <ResultRow
                    key={r.client.id}
                    client={r.client}
                    indexes={r.indexes}
                    active={i === active}
                    idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => navigate(r.client.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border bg-bg/30 px-4 py-2 text-[10.5px] text-text-muted">
            <div className="flex items-center gap-3">
              <KbdHint label="↑↓" sub="navigate" />
              <KbdHint label="↵" sub="open" />
              <KbdHint label="esc" sub="close" />
            </div>
            <div className="hidden text-[10.5px] text-text-muted sm:block">
              {results.length} result{results.length === 1 ? '' : 's'}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ResultRow({
  client,
  indexes,
  active,
  idx,
  onMouseEnter,
  onClick,
}: {
  client: Lite;
  indexes: number[];
  active: boolean;
  idx: number;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const status = (client.status ?? 'on-track') as keyof typeof STATUS_DOT;
  return (
    <li>
      <button
        type="button"
        data-idx={idx}
        onMouseEnter={onMouseEnter}
        onClick={onClick}
        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
          active ? 'bg-accent/10' : 'hover:bg-surface-2'
        }`}>
        <span
          aria-hidden
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status] ?? 'bg-border-strong'}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-medium text-text">
              {highlight(client.name, indexes)}
            </span>
            {client.engagement && (
              <span className="truncate text-[12px] text-text-muted">· {client.engagement}</span>
            )}
            {status === 'blocked' && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded border border-status-red/30 bg-status-red/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-status-red">
                <AlertOctagon className="h-2.5 w-2.5" />
                blocked
              </span>
            )}
            {status === 'at-risk' && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded border border-status-yellow/30 bg-status-yellow/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-status-yellow">
                <AlertTriangle className="h-2.5 w-2.5" />
                at risk
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-text-muted">
            {client.pmName && (
              <span>
                PM <span className="text-text-dim">{client.pmName}</span>
              </span>
            )}
            {client.adName && (
              <span>
                AD <span className="text-text-dim">{client.adName}</span>
              </span>
            )}
          </div>
        </div>
        <ArrowRight
          className={`h-3.5 w-3.5 shrink-0 transition ${
            active ? 'translate-x-0 text-accent opacity-100' : '-translate-x-1 text-text-muted opacity-0'
          }`}
        />
      </button>
    </li>
  );
}

function EmptyState({ query, hasClients }: { query: string; hasClients: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Search className="h-5 w-5 text-text-muted/50" />
      <p className="mt-2 text-[13px] text-text-dim">
        {!hasClients
          ? 'No clients yet — create one from the dashboard.'
          : query
            ? `No matches for “${query}”`
            : 'Start typing to find a client'}
      </p>
      {query && hasClients && (
        <p className="mt-1 text-[11px] text-text-muted">
          Try a partial name, engagement, or owner.
        </p>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <ul className="py-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 rounded bg-surface-2 animate-shimmer" />
            <div className="h-2.5 w-1/4 rounded bg-surface-2 animate-shimmer" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function KbdHint({ label, sub }: { label: string; sub: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded border border-border bg-bg/50 px-1 py-px text-[10px] font-medium text-text">
        {label}
      </kbd>
      <span>{sub}</span>
    </span>
  );
}
