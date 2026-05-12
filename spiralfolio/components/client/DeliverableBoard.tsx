import { Card, CardBody, CardHeader, CardTitle } from '@/components/shared/Card';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import type { BrainDeliverable } from '@/lib/db/brain';

export function DeliverableBoard({
  ours,
  theirs,
}: {
  ours: BrainDeliverable[];
  theirs: BrainDeliverable[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Column title="Our Deliverables" items={ours} side="us" />
      <Column title="Client Deliverables" items={theirs} side="client" />
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="stat-num text-[12px] text-text-muted">{items.length}</span>
      </CardHeader>
      <CardBody className="p-0">
        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Nothing here yet." description="Items will populate as call transcripts are processed." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((d, i) => (
              <li key={`${d.item}-${i}`} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-text">{d.item}</div>
                    {d.details && <div className="mt-0.5 text-[12px] text-text-muted">{d.details}</div>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                      {side === 'client' && d.owner && <span>Owner · {d.owner}</span>}
                      {d.due && <span>Due · {d.due}</span>}
                    </div>
                  </div>
                  <StatusBadge status={d.status ?? 'pending'} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
