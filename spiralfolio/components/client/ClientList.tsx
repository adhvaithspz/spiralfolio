'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Search,
  ArrowUpRight,
  AlertTriangle,
  Calendar,
  LayoutList,
  LayoutGrid,
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

export function ClientList({ items }: { items: Item[] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [view, setView] = useState<'list' | 'grid'>('list');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return items.filter(({ client }) => {
      if (status !== 'all' && client.status !== status) return false;
      if (!ql) return true;
      return (
        client.name.toLowerCase().includes(ql) ||
        (client.engagement ?? '').toLowerCase().includes(ql) ||
        (client.pmName ?? '').toLowerCase().includes(ql) ||
        (client.adName ?? '').toLowerCase().includes(ql)
      );
    });
  }, [items, q, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search clients, engagements, PM, AD…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
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
        <div className="ml-auto flex items-center gap-2">
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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 py-12 text-center text-[13px] text-text-muted">
          No clients match.
        </div>
      ) : view === 'list' ? (
        <div className="overflow-hidden rounded-xl border border-border surface-glass">
          <div className="hidden border-b border-border bg-surface-2/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted md:grid md:grid-cols-[1fr_auto_auto_auto] md:gap-6">
            <div>Client</div>
            <div className="w-32 text-right">Activity</div>
            <div className="w-28 text-right">Flags</div>
            <div className="w-32 text-right">Last call</div>
          </div>
          <div className="divide-y divide-border">
            {filtered.map(item => (
              <ClientRow key={item.client.id} {...item} />
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
  );
}

function ClientRow({ client, stats, cadence }: Item) {
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
              {client.name}
            </span>
            {client.engagement && (
              <span className="hidden truncate text-[12px] text-text-muted sm:inline">
                · {client.engagement}
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
        <span className="hidden items-center gap-1 text-[11px] text-text-muted md:flex">
          <Calendar className="h-3 w-3" />
          {stats.lastCallDate ? formatDate(stats.lastCallDate) : 'No calls'}
        </span>
        <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 text-text-muted opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
    </Link>
  );
}
