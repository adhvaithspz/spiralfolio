import Link from 'next/link';
import { ArrowUpRight, Calendar, MessageSquare } from 'lucide-react';
import { HealthIndicator } from '@/components/shared/HealthIndicator';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { QuickBriefing } from './QuickBriefing';
import { CallCadence } from './CallCadence';
import { formatDate } from '@/lib/utils';
import type { Client } from '@/lib/db/schema';
import type { BrainStats } from '@/lib/brain-stats';
import { staleness } from '@/lib/portfolio-stats';

const STATUS_STRIPE: Record<string, string> = {
  'on-track': 'bg-status-green/70',
  'at-risk': 'bg-status-yellow/70',
  blocked: 'bg-status-red/70',
  complete: 'bg-status-grey/50',
};

const STATUS_HOVER_BORDER: Record<string, string> = {
  'on-track': 'hover:border-status-green/40',
  'at-risk': 'hover:border-status-yellow/40',
  blocked: 'hover:border-status-red/40',
  complete: 'hover:border-border-strong',
};

export function ClientCard({
  client,
  stats,
  cadence,
}: {
  client: Client;
  stats: BrainStats;
  cadence: number[];
}) {
  const status = (client.status ?? 'on-track') as keyof typeof STATUS_STRIPE;
  const stale = staleness(stats);

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface transition hover:-translate-y-0.5 hover:bg-surface/80 hover:shadow-lg hover:shadow-black/40 ${STATUS_HOVER_BORDER[status] ?? ''}`}>
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-[3px] ${STATUS_STRIPE[status] ?? 'bg-border-strong'}`}
      />

      <div className="flex items-start justify-between gap-3 border-b border-border p-4 pl-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <HealthIndicator status={status} />
            <Link
              href={`/clients/${client.id}`}
              className="truncate text-sm font-semibold text-text transition group-hover:text-accent">
              {client.name}
            </Link>
            <StatusBadge status={status} size="xs" />
          </div>
          {client.engagement && (
            <div className="mt-0.5 truncate text-[12px] text-text-muted">{client.engagement}</div>
          )}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-text-muted">
            {client.pmName && (
              <span>
                PM · <span className="text-text-dim">{client.pmName}</span>
              </span>
            )}
            {client.adName && (
              <span>
                AD · <span className="text-text-dim">{client.adName}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href={`/clients/${client.id}`}
            aria-label="Open client"
            className="rounded-md p-1 text-text-muted opacity-0 transition group-hover:opacity-100 hover:bg-surface-2 hover:text-text">
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <CallCadence buckets={cadence} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-border-strong/40 pl-[3px]">
        <Cell label="Goals" value={stats.goals} />
        <Cell label="Concerns" value={stats.openConcerns} accent={stats.openConcerns ? 'yellow' : 'default'} />
        <Cell label="We owe" value={stats.ourPending} accent={stats.ourPending ? 'blue' : 'default'} />
        <Cell label="They owe" value={stats.theirPending} accent={stats.theirPending ? 'blue' : 'default'} />
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 pl-5 text-[11px] text-text-muted">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {stats.lastCallDate ? formatDate(stats.lastCallDate) : 'No calls yet'}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {stats.callCount} {stats.callCount === 1 ? 'call' : 'calls'}
          </span>
        </div>
        {stale.level !== 'fresh' && stale.days !== null && (
          <span
            className={`stat-num rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
              stale.level === 'very-stale'
                ? 'border-status-red/30 bg-status-red/10 text-status-red'
                : 'border-status-yellow/30 bg-status-yellow/10 text-status-yellow'
            }`}
            title={`${stale.days} days since last call`}>
            {stale.days}d stale
          </span>
        )}
      </div>

      <div className="border-t border-border bg-surface px-4 py-3 pl-5">
        <QuickBriefing clientId={client.id} compact />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'default' | 'yellow' | 'blue' | 'red' | 'green';
}) {
  const color =
    accent === 'yellow'
      ? 'text-status-yellow'
      : accent === 'blue'
        ? 'text-status-blue'
        : accent === 'red'
          ? 'text-status-red'
          : accent === 'green'
            ? 'text-status-green'
            : 'text-text';
  return (
    <div className="bg-surface px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`stat-num mt-0.5 text-base font-semibold leading-none ${color}`}>{value}</div>
    </div>
  );
}
