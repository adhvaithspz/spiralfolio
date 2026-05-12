'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, ArrowUpRight, AlertTriangle, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { staleness } from '@/lib/portfolio-stats';
import type { Client } from '@/lib/db/schema';
import type { BrainStats } from '@/lib/brain-stats';

type Item = { client: Client; stats: BrainStats };

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
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search…"
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`h-8 rounded-md px-3 text-[11px] font-medium capitalize transition ${
                status === s
                  ? 'bg-surface-2 text-text'
                  : 'text-text-muted hover:text-text'
              }`}>
              {s === 'all' ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-[13px] text-text-muted">No clients match.</div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {filtered.map(({ client, stats }) => (
            <ClientRow key={client.id} client={client} stats={stats} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientRow({ client, stats }: Item) {
  const status = (client.status ?? 'on-track') as keyof typeof STATUS_DOT;
  const stale = staleness(stats);
  const hasConcerns = stats.openConcerns > 0;
  const isBlocked = status === 'blocked';

  return (
    <Link
      href={`/clients/${client.id}`}
      className="group flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2 transition">

      {/* Status dot */}
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[status] ?? 'bg-border-strong'}`} />

      {/* Name + engagement */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text text-[14px] truncate">{client.name}</span>
          {client.engagement && (
            <span className="hidden sm:inline text-[12px] text-text-muted truncate">{client.engagement}</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-text-muted">
          {client.pmName && <span>PM · {client.pmName}</span>}
          {client.adName && <span>AD · {client.adName}</span>}
        </div>
      </div>

      {/* Flags */}
      <div className="flex items-center gap-3 shrink-0">
        {(hasConcerns || isBlocked) && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] ${
              isBlocked ? 'text-status-red' : 'text-status-yellow'
            }`}>
            <AlertTriangle className="h-3 w-3" />
            {stats.openConcerns > 0 ? `${stats.openConcerns} concern${stats.openConcerns === 1 ? '' : 's'}` : 'blocked'}
          </span>
        )}

        {stale.level !== 'fresh' && stale.days !== null && (
          <span
            className={`text-[11px] ${
              stale.level === 'very-stale' ? 'text-status-red' : 'text-status-yellow'
            }`}>
            {stale.days}d stale
          </span>
        )}

        <span className="hidden md:flex items-center gap-1 text-[11px] text-text-muted">
          <Calendar className="h-3 w-3" />
          {stats.lastCallDate ? formatDate(stats.lastCallDate) : 'No calls'}
        </span>

        <ArrowUpRight className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition" />
      </div>
    </Link>
  );
}
