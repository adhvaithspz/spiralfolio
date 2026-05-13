import Link from 'next/link';
import { Activity } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate, relativeTime } from '@/lib/utils';
import type { RecentActivityItem } from '@/lib/portfolio-stats';

export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border surface-glass">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-5 w-5 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Activity className="h-3 w-3" />
          </span>
          <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-text-dim">
            Recent Activity
          </h3>
        </div>
        <span className="stat-num rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
          {items.length} call{items.length === 1 ? '' : 's'}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No calls processed yet."
            description="Upload a transcript on any client to get started."
          />
        </div>
      ) : (
        <ol className="relative divide-y divide-border">
          {items.map(c => (
            <li key={c.callId} className="group">
              <Link
                href={`/clients/${c.clientId}/calls`}
                className="flex items-start gap-3 px-4 py-3 transition hover:bg-surface-2">
                <div className="relative mt-1 flex flex-col items-center">
                  <span className="h-2 w-2 rounded-full bg-accent ring-2 ring-accent/20" />
                </div>
                <div className="min-w-0 w-20 shrink-0">
                  <div className="stat-num text-[11px] text-text">{relativeTime(c.callDate)}</div>
                  <div className="text-[10px] text-text-muted">{formatDate(c.callDate)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-text">{c.clientName}</span>
                    {c.callType && <StatusBadge status={c.callType} size="xs" />}
                  </div>
                  {c.callSummary && (
                    <div className="mt-0.5 line-clamp-2 text-[12px] text-text-muted">{c.callSummary}</div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
