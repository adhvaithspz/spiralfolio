
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Tooltip } from '@/components/shared/Tooltip';
import { HistoryPopover, UpdateMarker, useHistoryPopoverSync } from '@/components/shared/HistoryPopover';
import type { BrainConcern } from '@/lib/types/brain';

export function OpenConcernRow({ concern: c }: { concern: BrainConcern }) {
  const { popoverProps, requestOpen } = useHistoryPopoverSync();
  return (
    <li className="group relative flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-surface-2">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[2px] bg-status-yellow/60" />
      <div className="min-w-0 pl-2">
        <div className="flex items-start gap-2">
          <div className="text-[13px] text-text">{c.concern}</div>
          <HistoryPopover history={c.history} className="mt-0.5 shrink-0" {...popoverProps} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
          {c.owner && (
            <span>
              Owner · <span className="text-text-dim">{c.owner}</span>
            </span>
          )}
          {c.blocker_for && (
            <Tooltip content="This concern is blocking the named initiative or deliverable until it is cleared or ownership moves.">
              <span className="inline-flex cursor-help text-status-red" tabIndex={0}>
                Blocking · {c.blocker_for}
              </span>
            </Tooltip>
          )}
          <UpdateMarker history={c.history} onOpenHistory={requestOpen} />
        </div>
      </div>
      <StatusBadge status={c.status ?? 'open'} />
    </li>
  );
}
