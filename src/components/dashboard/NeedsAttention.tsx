import { Link } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, ArrowRight, Clock, Hourglass } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import type { AttentionItem } from '@/lib/portfolio-stats';

const KIND: Record<
  AttentionItem['kind'],
  { icon: React.ReactNode; label: string; tone: string; stripe: string }
> = {
  'blocked-client': {
    icon: <AlertOctagon className="h-3 w-3" />,
    label: 'Blocked',
    tone: 'text-status-red bg-status-red/10 border-status-red/30',
    stripe: 'bg-status-red',
  },
  'at-risk-client': {
    icon: <AlertTriangle className="h-3 w-3" />,
    label: 'At risk',
    tone: 'text-status-yellow bg-status-yellow/10 border-status-yellow/30',
    stripe: 'bg-status-yellow',
  },
  'blocking-concern': {
    icon: <Hourglass className="h-3 w-3" />,
    label: 'Blocker',
    tone: 'text-status-red bg-status-red/10 border-status-red/30',
    stripe: 'bg-status-red',
  },
  'stale-client': {
    icon: <Clock className="h-3 w-3" />,
    label: 'Stale',
    tone: 'text-text-dim bg-surface-2 border-border-strong',
    stripe: 'bg-border-strong',
  },
};

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border surface-glass">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-5 w-5 items-center justify-center rounded-md bg-status-yellow/12 text-status-yellow">
            <AlertTriangle className="h-3 w-3" />
          </span>
          <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-text-dim">
            Needs Attention
          </h3>
        </div>
        <span className="stat-num rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            title="All clear."
            description="No blocked clients, blockers, or stale accounts right now."
          />
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {items.map((it, i) => {
            const meta = KIND[it.kind];
            return (
              <li key={`${it.clientId}-${i}`} className="group relative">
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 w-[2px] ${meta.stripe} opacity-60`}
                />
                <Link
                  to={`/clients/${it.clientId}`}
                  className="flex items-center gap-3 py-3 pl-5 pr-4 transition hover:bg-surface-2">
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${meta.tone}`}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-text">{it.detail}</div>
                    <div className="mt-0.5 truncate text-[11px] text-text-muted">
                      <span className="text-text-dim">{it.clientName}</span>
                      {it.meta && <> · {it.meta}</>}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-text-muted opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
