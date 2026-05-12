import { Card, CardBody, CardHeader, CardTitle } from '@/components/shared/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import type { BrainICP } from '@/lib/db/brain';

export function ICPPanel({ icp }: { icp: BrainICP }) {
  const empty =
    !icp.primary && !icp.secondary && !icp.key_motivators?.length && !icp.key_objections?.length;
  if (empty) {
    return <EmptyState title="No ICP profile yet." description="Will populate as calls are processed." />;
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Segments</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-[13px]">
          <Row label="Primary" value={icp.primary} />
          <Row label="Secondary" value={icp.secondary} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Motivators</CardTitle>
        </CardHeader>
        <CardBody>
          <BulletList items={icp.key_motivators ?? []} emptyText="None recorded." />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Objections / Friction</CardTitle>
        </CardHeader>
        <CardBody>
          <BulletList items={icp.key_objections ?? []} emptyText="None recorded." />
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Demographic Signals</CardTitle>
        </CardHeader>
        <CardBody>
          {icp.demographic_signals?.length ? (
            <ul className="space-y-1.5 text-[13px]">
              {icp.demographic_signals.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="text-text">{s.signal}</span>
                  {!s.confirmed && (
                    <span className="rounded-full border border-status-yellow/30 bg-status-yellow/10 px-1.5 py-px text-[9px] font-mono uppercase tracking-wider text-status-yellow">
                      unconfirmed
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[12px] text-text-muted">No signals recorded.</div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="mt-0.5 text-text">{value ?? <span className="text-text-muted">—</span>}</div>
    </div>
  );
}

function BulletList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (!items.length) return <div className="text-[12px] text-text-muted">{emptyText}</div>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-[13px]">
      {items.map((m, i) => (
        <li key={i} className="text-text">
          {m}
        </li>
      ))}
    </ul>
  );
}
