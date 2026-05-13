import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  Sparkles,
  Trophy,
  Flag,
  CheckCircle2,
} from 'lucide-react';

import { getClient, getClientBrain } from '@/lib/db/queries';
import { computeBrainStats } from '@/lib/brain-stats';
import type { ClientBrain } from '@/lib/db/brain';

import { Card, CardBody, CardHeader, CardTitle } from '@/components/shared/Card';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';

import { ClientHero } from '@/components/client/ClientHero';
import { MomentumPanel } from '@/components/client/MomentumPanel';
import { BrainTabs } from '@/components/client/BrainTabs';
import { DeliverableBoard } from '@/components/client/DeliverableBoard';
import { ContactList } from '@/components/client/ContactList';
import { CallTimeline } from '@/components/client/CallTimeline';
import { DocumentsPanel } from '@/components/client/DocumentsPanel';
import { QuickBriefing } from '@/components/client/QuickBriefing';

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
      <ClientHero client={client} lastCallDate={stats.lastCallDate} />

      <MomentumPanel stats={stats} brain={brain} wins={brain.wins?.length ?? 0} />

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
  const concerns = brain.open_concerns ?? [];
  const wins = brain.wins ?? [];
  const decisions = brain.decisions_made ?? [];
  const goals = brain.client_goals ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle icon={<AlertTriangle className="h-3.5 w-3.5 text-status-yellow" />}>
              Open Concerns
            </CardTitle>
            <span className="stat-num rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
              {concerns.length}
            </span>
          </CardHeader>
          <CardBody className="p-0">
            {concerns.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="All clear."
                  description="Nothing flagged at the moment."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {concerns.map((c, i) => (
                  <li
                    key={i}
                    className="group relative flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-surface-2">
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-[2px] bg-status-yellow/60"
                    />
                    <div className="min-w-0 pl-2">
                      <div className="text-[13px] text-text">{c.concern}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-muted">
                        {c.owner && (
                          <span>
                            Owner · <span className="text-text-dim">{c.owner}</span>
                          </span>
                        )}
                        {c.blocker_for && (
                          <span className="text-status-red">
                            Blocking · {c.blocker_for}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={c.status ?? 'open'} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle icon={<Trophy className="h-3.5 w-3.5 text-status-green" />}>
                Recent Wins
              </CardTitle>
              <span className="stat-num rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
                {wins.length}
              </span>
            </CardHeader>
            <CardBody>
              {wins.length === 0 ? (
                <EmptyState
                  title="No wins logged yet."
                  description="Wins are extracted from processed calls."
                />
              ) : (
                <ul className="space-y-2 text-[13px]">
                  {wins.slice(0, 6).map((w, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-status-green shadow-[0_0_0_3px_rgba(34,197,94,0.15)]" />
                      <span className="text-text">{w}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle icon={<CheckCircle2 className="h-3.5 w-3.5 text-accent" />}>
                Recent Decisions
              </CardTitle>
              <span className="stat-num rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
                {decisions.length}
              </span>
            </CardHeader>
            <CardBody>
              {decisions.length === 0 ? (
                <EmptyState title="No decisions logged." />
              ) : (
                <ul className="space-y-2 text-[13px]">
                  {decisions.slice(0, 6).map((d, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent shadow-[0_0_0_3px_rgba(99,102,241,0.18)]" />
                      <span className="text-text">{d}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

      </div>

      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl border border-accent/25 bg-gradient-to-br from-accent/8 via-surface to-surface p-px shadow-glow-soft">
          <div className="rounded-[11px] bg-surface">
            <div className="flex items-center gap-2 border-b border-accent/15 px-4 py-3">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-text">
                AI Briefing
              </h3>
            </div>
            <div className="p-4">
              <QuickBriefing clientId={clientId} compact />
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle icon={<Flag className="h-3.5 w-3.5 text-accent" />}>
              Goals & Success Metric
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-[13px]">
            {brain.success_metric && (
              <div className="rounded-lg border border-accent/20 bg-accent-soft px-3 py-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                  Success metric
                </div>
                <div className="mt-1 text-text">{brain.success_metric}</div>
              </div>
            )}
            {goals.length > 0 ? (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Client goals
                </div>
                <ul className="mt-2 space-y-1.5">
                  {goals.map((g, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-[3px] inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-[9px] font-semibold text-text-muted">
                        {i + 1}
                      </span>
                      <span className="text-text">{g}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              !brain.success_metric && <EmptyState title="No goals captured yet." />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
