'use client';

import { CheckCircle2 } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/shared/Card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { HistoryPopover, UpdateMarker, useHistoryPopoverSync } from '@/components/shared/HistoryPopover';
import { formatDate } from '@/lib/utils';
import type { BrainDeliverable } from '@/lib/db/brain';

const isDone = (d: BrainDeliverable) => (d.status ?? '').toLowerCase() === 'done';

export function DeliverableBoard({
  ours,
  theirs,
}: {
  ours: BrainDeliverable[];
  theirs: BrainDeliverable[];
}) {
  const completedOurs = ours.filter(isDone);
  const completedTheirs = theirs.filter(isDone);
  const hasCompleted = completedOurs.length + completedTheirs.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
        <Column title="Our Deliverables" items={ours.filter(d => !isDone(d))} side="us" />
        <Column title="Client Deliverables" items={theirs.filter(d => !isDone(d))} side="client" />
      </div>
      {hasCompleted && (
        <CompletedSection ours={completedOurs} theirs={completedTheirs} />
      )}
    </div>
  );
}

function Column({
  title,
  items,
  side,
}: {
  title: string;
  items: BrainDeliverable[];
  side: 'us' | 'client';
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0">
        <CardTitle>{title}</CardTitle>
        <span className="stat-num text-[12px] text-text-muted">{items.length}</span>
      </CardHeader>
      <CardBody className="min-h-0 flex-1 overflow-y-auto p-0">
        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Nothing here yet." description="Items will populate as call transcripts are processed." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((d, i) => (
              <DeliverableRow key={d.id ?? `${d.item}-${i}`} d={d} side={side} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function CompletedSection({ ours, theirs }: { ours: BrainDeliverable[]; theirs: BrainDeliverable[] }) {
  const all = [...ours.map(d => ({ d, side: 'us' as const })), ...theirs.map(d => ({ d, side: 'client' as const }))]
    .sort((a, b) => {
      const ta = a.d.completed_at ?? a.d.updated_at ?? '';
      const tb = b.d.completed_at ?? b.d.updated_at ?? '';
      return ta < tb ? 1 : -1;
    });
  if (all.length === 0) return null;
  return (
    <Card className="flex max-h-[min(32vh,280px)] shrink-0 flex-col overflow-hidden">
      <CardHeader className="shrink-0">
        <CardTitle icon={<CheckCircle2 className="h-3.5 w-3.5 text-status-green" />}>
          Recently Completed
        </CardTitle>
        <span className="stat-num text-[12px] text-text-muted">{all.length}</span>
      </CardHeader>
      <CardBody className="min-h-0 flex-1 overflow-y-auto p-0">
        <ul className="divide-y divide-border">
          {all.map(({ d, side }, i) => (
            <CompletedDeliverableRow key={d.id ?? `${d.item}-${i}`} d={d} side={side} />
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function DeliverableRow({ d, side }: { d: BrainDeliverable; side: 'us' | 'client' }) {
  const { popoverProps, requestOpen } = useHistoryPopoverSync();
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="text-[13px] font-medium text-text">{d.item}</div>
            <HistoryPopover history={d.history} className="mt-0.5 shrink-0" {...popoverProps} />
          </div>
          {d.details && <div className="mt-0.5 text-[12px] text-text-muted">{d.details}</div>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
            {side === 'client' && d.owner && <span>Owner · {d.owner}</span>}
            {d.due && <span>Due · {d.due}</span>}
            <UpdateMarker history={d.history} onOpenHistory={requestOpen} />
          </div>
        </div>
        <StatusBadge status={d.status ?? 'pending'} />
      </div>
    </li>
  );
}

function CompletedDeliverableRow({ d, side }: { d: BrainDeliverable; side: 'us' | 'client' }) {
  const { popoverProps, requestOpen } = useHistoryPopoverSync();
  return (
    <li className="px-4 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-green" />
            <div className="min-w-0">
              <div className="text-[13px] text-text-dim line-through decoration-text-muted/40">{d.item}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                <span className="uppercase tracking-wider">{side === 'us' ? 'Ours' : 'Client'}</span>
                {d.completed_at && <span>Completed · {formatDate(d.completed_at)}</span>}
                <HistoryPopover history={d.history} {...popoverProps} />
                <UpdateMarker history={d.history} completed onOpenHistory={requestOpen} />
              </div>
            </div>
          </div>
        </div>
        <StatusBadge status="done" />
      </div>
    </li>
  );
}
