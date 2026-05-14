import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  Sparkles,
  Trophy,
  CheckCircle2,
} from 'lucide-react';

import { getClient, getClientBrain } from '@/lib/db/queries';
import { computeBrainStats } from '@/lib/brain-stats';
import type { BrainDecision, BrainWin, ClientBrain } from '@/lib/db/brain';

import { Card, CardBody, CardHeader, CardTitle } from '@/components/shared/Card';
import { EmptyState } from '@/components/shared/EmptyState';

import { ClientHero } from '@/components/client/ClientHero';
import { MomentumPanel } from '@/components/client/MomentumPanel';
import { BrainTabs } from '@/components/client/BrainTabs';
import { DeliverableBoard } from '@/components/client/DeliverableBoard';
import { ContactList } from '@/components/client/ContactList';
import { CallTimeline } from '@/components/client/CallTimeline';
import { DocumentsPanel } from '@/components/client/DocumentsPanel';
import { OpenConcernRow } from '@/components/client/OpenConcernRow';
import { QuickBriefing } from '@/components/client/QuickBriefing';
import { CallGroupedEntries } from '@/components/client/CallGroupedEntries';

export const dynamic = 'force-dynamic';

export default async function ClientPage({ params }: { params: { id: string } }) {
  const [client, brain] = await Promise.all([
    getClient(params.id),
    getClientBrain(params.id),
  ]);
  if (!client) notFound();

  const stats = computeBrainStats(brain);

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] max-h-[calc(100dvh-6.5rem)] flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-col gap-6">
        <ClientHero client={client} lastCallDate={stats.lastCallDate} />

        <MomentumPanel stats={stats} brain={brain} wins={brain.win_entries?.length ?? brain.wins?.length ?? 0} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
  const wins: BrainWin[] =
    brain.win_entries ??
    (brain.wins ?? []).map((text, i) => ({
      id: `legacy-win-${i}`,
      text,
      call_date: undefined,
    }));
  const decisions: BrainDecision[] =
    brain.decisions ??
    (brain.decisions_made ?? []).map((text, i) => ({
      id: `legacy-decision-${i}`,
      text,
      call_date: undefined,
    }));

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2 lg:grid-rows-2">
      <Card className="flex h-full min-h-[200px] flex-col overflow-hidden lg:min-h-0">
        <CardHeader>
          <CardTitle icon={<AlertTriangle className="h-3.5 w-3.5 text-status-yellow" />}>
            Open Concerns
          </CardTitle>
          <span className="stat-num rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
            {concerns.length}
          </span>
        </CardHeader>
        <CardBody className="min-h-0 flex-1 overflow-y-auto p-0">
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
                <OpenConcernRow key={c.id ?? `concern-${i}`} concern={c} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="relative flex h-full min-h-[200px] flex-col overflow-hidden rounded-xl border border-accent/25 bg-gradient-to-br from-accent/8 via-surface to-surface p-px shadow-glow-soft lg:min-h-0">
        <div className="flex h-full min-h-0 flex-1 flex-col rounded-[11px] bg-surface">
          <div className="flex items-center gap-2 border-b border-accent/15 px-4 py-3">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-text">
              AI Briefing
            </h3>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <QuickBriefing clientId={clientId} compact />
          </div>
        </div>
      </div>

      <Card className="flex h-full min-h-[200px] flex-col overflow-hidden lg:min-h-0">
        <CardHeader className="shrink-0 items-start">
          <div>
            <CardTitle icon={<Trophy className="h-3.5 w-3.5 text-status-green" />}>
              Wins by call
            </CardTitle>
            <p className="mt-1 max-w-xl text-[11px] font-normal normal-case tracking-normal text-text-muted">
              Pick a call date in the strip below to read wins from that session.
            </p>
          </div>
          <span className="stat-num shrink-0 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
            {wins.length}
          </span>
        </CardHeader>
        <CardBody className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0">
          <CallGroupedEntries
            variant="wins"
            items={wins.map(w => ({ id: w.id, text: w.text, call_date: w.call_date }))}
            emptyTitle="No wins logged yet."
            emptyDescription="Wins appear here after each call transcript is processed."
          />
        </CardBody>
      </Card>

      <Card className="flex h-full min-h-[200px] flex-col overflow-hidden lg:min-h-0">
        <CardHeader className="shrink-0 items-start">
          <div>
            <CardTitle icon={<CheckCircle2 className="h-3.5 w-3.5 text-accent" />}>
              Decisions by call
            </CardTitle>
            <p className="mt-1 max-w-xl text-[11px] font-normal normal-case tracking-normal text-text-muted">
              Scroll dates horizontally, then select one to view decisions from that call.
            </p>
          </div>
          <span className="stat-num shrink-0 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
            {decisions.length}
          </span>
        </CardHeader>
        <CardBody className="flex min-h-0 flex-1 flex-col overflow-hidden pt-0">
          <CallGroupedEntries
            variant="decisions"
            items={decisions.map(d => ({ id: d.id, text: d.text, call_date: d.call_date }))}
            emptyTitle="No decisions logged yet."
            emptyDescription="Decisions surface here when synthesis extracts them from a call."
          />
        </CardBody>
      </Card>
    </div>
  );
}
