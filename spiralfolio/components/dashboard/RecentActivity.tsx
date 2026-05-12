import Link from 'next/link';
import { Activity } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate, relativeTime } from '@/lib/utils';
import type { RecentActivityItem } from '@/lib/portfolio-stats';

export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-accent" />
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-text-dim">Recent Calls</h3>
        </div>
        <span className="stat-num text-[11px] text-text-muted">
          {items.length} call{items.length === 1 ? '' : 's'}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No calls processed yet."
            description="Upload a transcript on any client to get started."
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map(c => (
            <li key={c.callId} className="group">
              <Link
                href={`/clients/${c.clientId}/calls`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
                <div className="mt-0.5 w-16 shrink-0">
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
        </ul>
      )}
    </div>
  );
}
