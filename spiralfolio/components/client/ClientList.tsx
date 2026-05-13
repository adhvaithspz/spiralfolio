'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  ArrowUpRight,
  AlertTriangle,
  Calendar,
  LayoutList,
  LayoutGrid,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { staleness } from '@/lib/portfolio-stats';
import { CallCadence } from './CallCadence';
import type { Client } from '@/lib/db/schema';
import type { BrainStats } from '@/lib/brain-stats';
import { ClientCard } from './ClientCard';

type Item = { client: Client; stats: BrainStats; cadence?: number[] };

const STATUS_STRIPE: Record<string, string> = {
  'on-track': 'bg-status-green',
  'at-risk': 'bg-status-yellow',
  blocked: 'bg-status-red',
  complete: 'bg-status-grey',
};

const STATUS_DOT: Record<string, string> = {
  'on-track': 'bg-status-green',
  'at-risk': 'bg-status-yellow',
  blocked: 'bg-status-red',
  complete: 'bg-border-strong',
};

const STATUS_LABEL: Record<string, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  blocked: 'Blocked',
  complete: 'Complete',
};

const STATUSES = ['all', 'on-track', 'at-risk', 'blocked', 'complete'] as const;

const SORTS = [
  { id: 'recent', label: 'Most recent call' },
  { id: 'stale', label: 'Stalest first' },
  { id: 'concerns', label: 'Most concerns' },
  { id: 'name', label: 'Name (A → Z)' },
] as const;

type SortId = (typeof SORTS)[number]['id'];

export function ClientList({ items }: { items: Item[] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [sort, setSort] = useState<SortId>('recent');
  const [needsAttention, setNeedsAttention] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // '/' focuses the inline search (only when not already typing somewhere).
  // The global ClientFinder also listens for '/'; it skips the shortcut while
  // the user is typing in any input, so this remains the local fallback.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (inField) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = items.filter(({ client, stats }) => {
      if (status !== 'all' && client.status !== status) return false;
      if (needsAttention) {
        const stale = staleness(stats);
        const flagged =
          client.status === 'blocked' ||
          client.status === 'at-risk' ||
          stats.openConcerns > 0 ||
          stale.level !== 'fresh';
        if (!flagged) return false;
      }
      if (!ql) return true;
      return (
        client.name.toLowerCase().includes(ql) ||
        (client.engagement ?? '').toLowerCase().includes(ql) ||
        (client.pmName ?? '').toLowerCase().includes(ql) ||
        (client.adName ?? '').toLowerCase().includes(ql)
      );
    });

    const ts = (s: string | null) => (s ? new Date(s).getTime() : 0);
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.client.name.localeCompare(b.client.name);
        case 'concerns':
          return b.stats.openConcerns - a.stats.openConcerns;
        case 'stale': {
          const av = a.stats.lastCallDate ? ts(a.stats.lastCallDate) : -Infinity;
          const bv = b.stats.lastCallDate ? ts(b.stats.lastCallDate) : -Infinity;
          return av - bv;
        }
        case 'recent':
        default:
          return ts(b.stats.lastCallDate) - ts(a.stats.lastCallDate);
      }
    });
    return sorted;
  }, [items, q, status, sort, needsAttention]);

  const ql = q.trim().toLowerCase();

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape' && q) {
                e.preventDefault();
                setQ('');
              }
            }}
            placeholder="Filter visible list — name, engagement, PM, AD"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-16 text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted transition hover:bg-surface-2 hover:text-text">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-bg/50 px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
              /
            </kbd>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`h-7 rounded-md px-2.5 text-[11px] font-medium capitalize transition ${
                status === s
                  ? 'bg-surface-2 text-text shadow-[inset_0_0_0_1px_rgba(99,102,241,0.25)]'
                  : 'text-text-muted hover:text-text'
              }`}>
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <button
          onClick={() => setNeedsAttention(v => !v)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium transition ${
            needsAttention
              ? 'border-status-yellow/40 bg-status-yellow/10 text-status-yellow'
              : 'border-border bg-surface text-text-muted hover:border-border-strong hover:text-text'
          }`}
          title="Show only blocked, at-risk, with open concerns, or stale">
          <AlertTriangle className="h-3 w-3" />
          Needs attention
        </button>

        <div className="ml-auto flex items-center gap-2">
          <SortMenu sort={sort} onChange={setSort} />
          <span className="hidden text-[11px] text-text-muted sm:inline">
            <span className="text-text">{filtered.length}</span> of {items.length}
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            <button
              onClick={() => setView('list')}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                view === 'list' ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text'
              }`}
              aria-label="List view">
              <LayoutList className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                view === 'grid' ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text'
              }`}
              aria-label="Grid view">
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 lg:overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyResults
            query={q}
            onClear={() => {
              setQ('');
              setStatus('all');
              setNeedsAttention(false);
            }}
          />
        ) : view === 'list' ? (
          <div className="overflow-hidden rounded-xl border border-border surface-glass">
            <div className="sticky top-0 z-10 hidden border-b border-border bg-surface-2/95 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted backdrop-blur md:grid md:grid-cols-[1fr_auto_auto_auto] md:gap-6">
              <div>Client</div>
              <div className="w-32 text-right">Activity</div>
              <div className="w-28 text-right">Flags</div>
              <div className="w-32 text-right">Last call</div>
            </div>
            <div className="divide-y divide-border">
              {filtered.map(item => (
                <ClientRow key={item.client.id} {...item} highlight={ql} />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(({ client, stats, cadence }) => (
              <ClientCard
                key={client.id}
                client={client}
                stats={stats}
                cadence={cadence ?? new Array(12).fill(0)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SortMenu({ sort, onChange }: { sort: SortId; onChange: (s: SortId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const current = SORTS.find(s => s.id === sort) ?? SORTS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-[11px] text-text-muted transition hover:border-border-strong hover:text-text">
        <ArrowUpDown className="h-3 w-3" />
        <span className="hidden sm:inline">{current.label}</span>
        <span className="sm:hidden">Sort</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          {SORTS.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12px] transition hover:bg-surface-2 ${
                sort === s.id ? 'text-text' : 'text-text-muted'
              }`}>
              {s.label}
              {sort === s.id && <span className="text-accent">●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 py-12 text-center text-[13px] text-text-muted">
      <Search className="mb-2 h-4 w-4 text-text-muted/60" />
      <p>
        {query ? (
          <>
            No clients match <span className="text-text">“{query}”</span>
          </>
        ) : (
          'No clients match the current filters.'
        )}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] text-text-muted transition hover:border-border-strong hover:text-text">
        Clear filters
      </button>
    </div>
  );
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-accent/20 px-0.5 text-text">
        {text.slice(i, i + query.length)}
      </mark>
      {text.slice(i + query.length)}
    </>
  );
}

function ClientRow({ client, stats, cadence, highlight }: Item & { highlight?: string }) {
  const status = (client.status ?? 'on-track') as keyof typeof STATUS_DOT;
  const stale = staleness(stats);
  const hasConcerns = stats.openConcerns > 0;
  const isBlocked = status === 'blocked';

  return (
    <Link
      href={`/clients/${client.id}`}
      className="group relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-6 px-4 py-3.5 transition hover:bg-surface-2">
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[2px] ${STATUS_STRIPE[status] ?? 'bg-border-strong'} opacity-0 transition group-hover:opacity-80`}
      />

      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[status] ?? 'bg-border-strong'} shadow-[0_0_0_3px_rgba(255,255,255,0.04)]`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-medium text-text group-hover:text-accent-hover">
              <HighlightText text={client.name} query={highlight ?? ''} />
            </span>
            {client.engagement && (
              <span className="hidden truncate text-[12px] text-text-muted sm:inline">
                · <HighlightText text={client.engagement} query={highlight ?? ''} />
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-text-muted">
            {client.pmName && (
              <span>
                PM{' '}
                <span className="text-text-dim">
                  <HighlightText text={client.pmName} query={highlight ?? ''} />
                </span>
              </span>
            )}
            {client.adName && (
              <span>
                AD{' '}
                <span className="text-text-dim">
                  <HighlightText text={client.adName} query={highlight ?? ''} />
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="hidden w-32 items-center justify-end md:flex">
        {cadence && cadence.some(n => n > 0) ? (
          <CallCadence buckets={cadence} />
        ) : (
          <span className="text-[10px] text-text-muted">no activity</span>
        )}
      </div>

      <div className="hidden w-28 items-center justify-end gap-2 md:flex">
        {(hasConcerns || isBlocked) && (
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
              isBlocked
                ? 'border-status-red/30 bg-status-red/10 text-status-red'
                : 'border-status-yellow/30 bg-status-yellow/10 text-status-yellow'
            }`}>
            <AlertTriangle className="h-2.5 w-2.5" />
            {stats.openConcerns > 0
              ? `${stats.openConcerns}`
              : 'blocked'}
          </span>
        )}
        {stale.level !== 'fresh' && stale.days !== null && (
          <span
            className={`stat-num rounded-md border px-1.5 py-0.5 text-[10px] ${
              stale.level === 'very-stale'
                ? 'border-status-red/30 bg-status-red/10 text-status-red'
                : 'border-status-yellow/30 bg-status-yellow/10 text-status-yellow'
            }`}>
            {stale.days}d
          </span>
        )}
      </div>

      <div className="flex w-32 items-center justify-end gap-2">
        <span className="hidden items-center gap-1 whitespace-nowrap text-[11px] text-text-muted md:flex">
          <Calendar className="h-3 w-3" />
          {stats.lastCallDate ? formatDate(stats.lastCallDate) : 'No calls'}
        </span>
        <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 text-text-muted opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
    </Link>
  );
}
