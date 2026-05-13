import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { getClient, getClientBrain } from '@/lib/db/queries';
import { computeBrainStats } from '@/lib/brain-stats';
import { formatDate } from '@/lib/utils';
import type { ClientBrain } from '@/lib/db/brain';

import { HealthIndicator } from '@/components/shared/HealthIndicator';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Stat } from '@/components/shared/Stat';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/shared/Card';
import { EmptyState } from '@/components/shared/EmptyState';

import { BrainTabs } from '@/components/client/BrainTabs';
import { DeliverableBoard } from '@/components/client/DeliverableBoard';
import { ContactList } from '@/components/client/ContactList';
import { CallTimeline } from '@/components/client/CallTimeline';
import { DocumentsPanel } from '@/components/client/DocumentsPanel';
import { QuickBriefing } from '@/components/client/QuickBriefing';
import { TranscriptUploader } from '@/components/calls/TranscriptUploader';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params }: { params: { id: string } }) {
  const [client, brain] = await Promise.all([
    getClient(params.id),
    getClientBrain(params.id),
  ]);
  if (!client) notFound();

  const stats = computeBrainStats(brain);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text">
          <ChevronLeft className="h-3.5 w-3.5" /> All clients
        </Link>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <HealthIndicator status={client.status ?? 'on-track'} />
              <h1 className="text-2xl font-semibold tracking-tight text-text">{client.name}</h1>
              <StatusBadge status={client.status ?? 'on-track'} />
            </div>
            <div className="mt-1 text-[13px] text-text-muted">
              {client.engagement && <>{client.engagement}</>}
              {client.pmName && (
                <>
                  {client.engagement ? ' · ' : ''}PM <span className="text-text-dim">{client.pmName}</span>
                </>
              )}
              {client.adName && (
                <>
                  {' '}
                  · AD <span className="text-text-dim">{client.adName}</span>
                </>
              )}
              {stats.lastCallDate && <> · Last call {formatDate(stats.lastCallDate)}</>}
            </div>
          </div>
          <TranscriptUploader clientId={client.id} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Goals" value={stats.goals} />
        <Stat
          label="Open Concerns"
          value={stats.openConcerns}
          accent={stats.openConcerns ? 'yellow' : 'default'}
        />
        <Stat label="We Owe" value={stats.ourPending} accent={stats.ourPending ? 'blue' : 'default'} />
        <Stat label="They Owe" value={stats.theirPending} accent={stats.theirPending ? 'blue' : 'default'} />
      </div>

      <BrainTabs
        panels={{
          overview: <OverviewTab brain={brain} clientId={client.id} />,
          deliverables: (
            <DeliverableBoard
              ours={brain.our_deliverables ?? []}
              theirs={brain.client_deliverables ?? []}
            />
          ),
          contacts: (
            <ContactList
              clientContacts={brain.client_contacts ?? []}
              internalTeam={buildInternalTeam(client.pmName, client.adName, brain.internal_team ?? [])}
            />
          ),
          calls: <CallTimeline entries={brain.call_log ?? []} />,
          documents: (
            <DocumentsPanel
              clientId={client.id}
              initialFolderUrl={client.driveFolderUrl}
              documents={brain.documents ?? []}
            />
          ),
        }}
      />
    </div>
  );
}

function buildInternalTeam(
  pm: string | null,
  ad: string | null,
  existing: import('@/lib/db/brain').BrainContact[],
) {
  const names = new Set(existing.map(c => c.name.toLowerCase()));
  const pinned: import('@/lib/db/brain').BrainContact[] = [];
  if (pm && !names.has(pm.toLowerCase())) pinned.push({ name: pm, role: 'PM' });
  if (ad && !names.has(ad.toLowerCase())) pinned.push({ name: ad, role: 'AD' });
  return [...pinned, ...existing];
}

function OverviewTab({ brain, clientId }: { brain: ClientBrain; clientId: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Open Concerns</CardTitle>
            <span className="stat-num text-[12px] text-text-muted">{brain.open_concerns?.length ?? 0}</span>
          </CardHeader>
          <CardBody className="p-0">
            {!brain.open_concerns?.length ? (
              <div className="p-4">
                <EmptyState title="No open concerns. 🎉" description="Nothing flagged at the moment." />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {brain.open_concerns.map((c, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[13px] text-text">{c.concern}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                        {c.owner && <span>Owner · {c.owner}</span>}
                        {c.blocker_for && <span>Blocking · {c.blocker_for}</span>}
                      </div>
                    </div>
                    <StatusBadge status={c.status ?? 'open'} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Wins</CardTitle>
            <span className="stat-num text-[12px] text-text-muted">{brain.wins?.length ?? 0}</span>
          </CardHeader>
          <CardBody>
            {!brain.wins?.length ? (
              <EmptyState title="No wins logged yet." description="Wins are extracted from processed calls." />
            ) : (
              <ul className="space-y-2 text-[13px]">
                {brain.wins.slice(0, 8).map((w, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-status-green" />
                    <span className="text-text">{w}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Goals & Success Metric</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-[13px]">
            {brain.success_metric && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Success metric</div>
                <div className="mt-0.5 text-text">{brain.success_metric}</div>
              </div>
            )}
            {!!brain.client_goals?.length && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Client goals</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text">
                  {brain.client_goals.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            {!brain.success_metric && !brain.client_goals?.length && (
              <EmptyState title="No goals captured yet." />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <QuickBriefing clientId={clientId} />
        {!!brain.decisions_made?.length && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Decisions</CardTitle>
              <span className="stat-num text-[12px] text-text-muted">{brain.decisions_made.length}</span>
            </CardHeader>
            <CardBody>
              <ul className="space-y-2 text-[13px]">
                {brain.decisions_made.slice(0, 6).map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                    <span className="text-text">{d}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
