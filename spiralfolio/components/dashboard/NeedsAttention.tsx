import Link from 'next/link';
import { AlertOctagon, AlertTriangle, ArrowRight, Clock, Hourglass } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import type { AttentionItem } from '@/lib/portfolio-stats';

const KIND: Record<
  AttentionItem['kind'],
  { icon: React.ReactNode; label: string; tone: string }
> = {
  'blocked-client': {
    icon: <AlertOctagon className="h-3.5 w-3.5" />,
    label: 'Blocked',
    tone: 'text-status-red bg-status-red/10 border-status-red/30',
  },
  'at-risk-client': {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    label: 'At risk',
    tone: 'text-status-yellow bg-status-yellow/10 border-status-yellow/30',
  },
  'blocking-concern': {
    icon: <Hourglass className="h-3.5 w-3.5" />,
    label: 'Blocker',
    tone: 'text-status-red bg-status-red/10 border-status-red/30',
  },
  'stale-client': {
    icon: <Clock className="h-3.5 w-3.5" />,
    label: 'Stale',
    tone: 'text-text-dim bg-surface-2 border-border-strong',
  },
};

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-status-yellow" />
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-text-dim">Needs Attention</h3>
        </div>
        <span className="stat-num text-[11px] text-text-muted">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="All clear."
            description="No blocked clients, blockers, or stale accounts right now."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it, i) => {
            const meta = KIND[it.kind];
            return (
              <li key={`${it.clientId}-${i}`} className="group">
                <Link
                  href={`/clients/${it.clientId}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${meta.tone}`}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-text">{it.detail}</div>
                    <div className="mt-0.5 truncate text-[11px] text-text-muted">
                      {it.clientName}
                      {it.meta && <> · {it.meta}</>}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-muted opacity-0 transition group-hover:opacity-100" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
