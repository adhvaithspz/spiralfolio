'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { History, CheckCircle2, ArrowUpRight, RefreshCw, Sparkles, ArrowRight } from 'lucide-react';
import type { HistoryEntry } from '@/lib/db/brain';
import { formatDate, relativeTime, cn } from '@/lib/utils';

const KIND_META: Record<HistoryEntry['kind'], { label: string; tone: string; icon: React.ReactNode }> = {
  created: { label: 'Created', tone: 'text-text-muted', icon: <Sparkles className="h-3 w-3" /> },
  updated: { label: 'Updated', tone: 'text-status-blue', icon: <RefreshCw className="h-3 w-3" /> },
  status: { label: 'Status', tone: 'text-status-blue', icon: <ArrowUpRight className="h-3 w-3" /> },
  extended: { label: 'Extended', tone: 'text-status-blue', icon: <ArrowRight className="h-3 w-3" /> },
  completed: { label: 'Completed', tone: 'text-status-green', icon: <CheckCircle2 className="h-3 w-3" /> },
};

function meaningfulEntries(history: HistoryEntry[] | undefined) {
  if (!history?.length) return null;
  const meaningful = history.filter(h => h.kind !== 'created');
  if (meaningful.length === 0) return null;
  const sorted = [...meaningful].sort((a, b) => (a.at < b.at ? 1 : -1));
  return { meaningful, sorted, last: sorted[0] };
}

function HistoryPopoverPanel({ sorted }: { sorted: HistoryEntry[] }) {
  const last = sorted[0];
  const lastMeta = KIND_META[last.kind];
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Update history</span>
        <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium', lastMeta.tone)}>
          {lastMeta.icon}
          <span>
            {lastMeta.label} {relativeTime(last.at)}
          </span>
        </span>
      </div>
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {sorted.map((h, i) => {
          const meta = KIND_META[h.kind];
          return (
            <li key={i} className="rounded-md border border-border bg-surface px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider',
                    meta.tone,
                  )}>
                  {meta.icon}
                  {meta.label}
                </span>
                <span className="stat-num text-[10px] text-text-muted" title={h.at}>
                  {formatDate(h.call_date ?? h.at)}
                </span>
              </div>
              {(h.prev_status || h.new_status) && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-dim">
                  {h.prev_status && <span className="font-mono uppercase">{h.prev_status}</span>}
                  {h.prev_status && h.new_status && <ArrowRight className="h-3 w-3 text-text-muted" />}
                  {h.new_status && <span className="font-mono uppercase text-text">{h.new_status}</span>}
                </div>
              )}
              {(h.prev_text || h.new_text) && (
                <div className="mt-1 space-y-1 text-[11.5px]">
                  {h.prev_text && (
                    <div className="text-text-muted line-through decoration-text-muted/40">{h.prev_text}</div>
                  )}
                  {h.new_text && <div className="text-text">{h.new_text}</div>}
                </div>
              )}
              {h.note && <div className="mt-1 text-[11.5px] text-text">{h.note}</div>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * Shared open state when a row has both HistoryPopover and UpdateMarker.
 */
export function useHistoryPopoverSync() {
  const [open, setOpen] = useState(false);
  return {
    open,
    setOpen,
    requestOpen: () => setOpen(true),
    popoverProps: { open, onOpenChange: setOpen } as const,
  };
}

/**
 * Inline "n updates" pill that opens a history popover. Renders nothing if
 * the row only has a single "created" entry — there's nothing interesting
 * to show in that case.
 */
export function HistoryPopover({
  history,
  className,
  align = 'end',
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  history?: HistoryEntry[];
  className?: string;
  align?: 'start' | 'center' | 'end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined && controlledOnOpenChange !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const handleOpenChange = (next: boolean) => {
    if (isControlled) controlledOnOpenChange(next);
    else setUncontrolledOpen(next);
  };

  const built = meaningfulEntries(history);
  if (!built) return null;
  const { sorted, last, meaningful } = built;

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-muted transition hover:border-accent/40 hover:text-text',
            className,
          )}
          title={`${meaningful.length} update${meaningful.length === 1 ? '' : 's'} — last ${relativeTime(last.at)}`}
        >
          <History className="h-3 w-3" />
          <span>
            {meaningful.length} update{meaningful.length === 1 ? '' : 's'}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          className="z-50 w-80 rounded-lg border border-border bg-surface-2 p-3 text-[12px] shadow-xl outline-none animate-rise"
        >
          <HistoryPopoverPanel sorted={sorted} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * Last activity summary (e.g. "Status · 2h ago"). With onOpenHistory,
 * opens the same history surface as the pill trigger.
 */
export function UpdateMarker({
  history,
  className,
  completed,
  onOpenHistory,
}: {
  history?: HistoryEntry[];
  className?: string;
  completed?: boolean;
  onOpenHistory?: () => void;
}) {
  const built = meaningfulEntries(history);
  if (!built) return null;
  const { last } = built;
  const meta = KIND_META[last.kind];
  const label = completed ? 'Completed' : meta.label;
  const titleText = `${label} ${formatDate(last.call_date ?? last.at)}${onOpenHistory ? ' — click for full update history' : ''}`;

  const content = (
    <>
      {completed ? <CheckCircle2 className="h-3 w-3" /> : meta.icon}
      <span>
        {label} {relativeTime(last.at)}
      </span>
    </>
  );

  const sharedClass = cn(
    'inline-flex items-center gap-1 text-[10.5px]',
    completed ? 'text-status-green' : meta.tone,
    className,
  );

  if (onOpenHistory) {
    return (
      <button
        type="button"
        className={cn(
          sharedClass,
          'cursor-pointer border-0 bg-transparent p-0 text-left font-sans underline decoration-transparent decoration-1 underline-offset-2 transition hover:decoration-current',
        )}
        title={titleText}
        onClick={() => onOpenHistory()}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={sharedClass} title={titleText}>
      {content}
    </span>
  );
}
