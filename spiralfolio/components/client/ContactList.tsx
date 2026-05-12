import { Card, CardBody, CardHeader, CardTitle } from '@/components/shared/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import type { BrainContact } from '@/lib/db/brain';

export function ContactList({
  clientContacts,
  internalTeam,
}: {
  clientContacts: BrainContact[];
  internalTeam: BrainContact[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Group title="Client Contacts" contacts={clientContacts} />
      <Group title="Internal Team" contacts={internalTeam} />
    </div>
  );
}

function Group({ title, contacts }: { title: string; contacts: BrainContact[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <span className="stat-num text-[12px] text-text-muted">{contacts.length}</span>
      </CardHeader>
      <CardBody className="p-0">
        {contacts.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No contacts yet." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {contacts.map((c, i) => (
              <li key={`${c.name}-${i}`} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[13px] font-medium text-text">{c.name}</div>
                    {c.is_approver && (
                      <span className="rounded-full border border-accent/30 bg-accent/10 px-1.5 py-px text-[9px] font-mono uppercase tracking-wider text-accent">
                        approver
                      </span>
                    )}
                  </div>
                  {c.role && <div className="text-[11px] text-text-muted">{c.role}</div>}
                  {c.notes && <div className="mt-1 text-[12px] text-text-dim">{c.notes}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
