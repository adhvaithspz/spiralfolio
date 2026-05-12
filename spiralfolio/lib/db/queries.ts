import 'server-only';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from './index';
import {
  calls,
  clients,
  concerns,
  contacts,
  decisions,
  deliverables,
  documents,
  goals,
  icpProfile,
  wins,
  type Call,
  type Client,
  type Concern,
  type Contact,
  type Deliverable,
  type Document,
} from './schema';
import {
  EMPTY_BRAIN,
  type BrainCallLogEntry,
  type BrainConcern,
  type BrainContact,
  type BrainDeliverable,
  type BrainDocumentRef,
  type BrainICP,
  type ClientBrain,
} from './brain';
import { safeParse } from '@/lib/utils/json';

// ─── Single-table reads ──────────────────────────────────────────────────────

export function getClient(id: string): Client | undefined {
  return db.select().from(clients).where(eq(clients.id, id)).get();
}

export function listClients(): Client[] {
  return db.select().from(clients).orderBy(desc(clients.updatedAt)).all();
}

export function listGoals(clientId: string) {
  return db.select().from(goals).where(eq(goals.clientId, clientId)).orderBy(asc(goals.position)).all();
}

export function listContacts(clientId: string): Contact[] {
  return db.select().from(contacts).where(eq(contacts.clientId, clientId)).orderBy(asc(contacts.createdAt)).all();
}

export function listConcerns(clientId: string): Concern[] {
  return db.select().from(concerns).where(eq(concerns.clientId, clientId)).orderBy(asc(concerns.createdAt)).all();
}

export function listDeliverables(clientId: string): Deliverable[] {
  return db
    .select()
    .from(deliverables)
    .where(eq(deliverables.clientId, clientId))
    .orderBy(asc(deliverables.createdAt))
    .all();
}

export function listDecisions(clientId: string) {
  return db.select().from(decisions).where(eq(decisions.clientId, clientId)).orderBy(desc(decisions.decidedAt)).all();
}

export function listWins(clientId: string) {
  return db.select().from(wins).where(eq(wins.clientId, clientId)).orderBy(desc(wins.wonAt)).all();
}

export function getIcpProfile(clientId: string) {
  return db.select().from(icpProfile).where(eq(icpProfile.clientId, clientId)).get();
}

export function listDocuments(clientId: string): Document[] {
  return db
    .select()
    .from(documents)
    .where(eq(documents.clientId, clientId))
    .orderBy(desc(documents.ingestedAt))
    .all();
}

export function listCalls(clientId: string): Call[] {
  return db.select().from(calls).where(eq(calls.clientId, clientId)).orderBy(desc(calls.callDate)).all();
}

// ─── Mappers row → brain shape ───────────────────────────────────────────────

function toBrainContact(c: Contact): BrainContact {
  return {
    name: c.name,
    role: c.role ?? undefined,
    is_approver: c.isApprover ?? false,
    notes: c.notes ?? undefined,
  };
}

function toBrainConcern(c: Concern): BrainConcern {
  return {
    concern: c.concern,
    owner: c.owner ?? undefined,
    blocker_for: c.blockerFor ?? undefined,
    status: c.status,
  };
}

function toBrainDeliverable(d: Deliverable): BrainDeliverable {
  return {
    item: d.item,
    details: d.details ?? undefined,
    owner: d.owner ?? undefined,
    due: d.due ?? undefined,
    status: d.status,
  };
}

function toBrainDocument(d: Document): BrainDocumentRef {
  return {
    id: d.id,
    name: d.name ?? '',
    type: d.docType ?? undefined,
    key_facts: safeParse<string[]>(d.keyFacts ?? '[]', []),
    flags: safeParse<string[]>(d.flags ?? '[]', []),
  };
}

function toBrainCallEntry(c: Call): BrainCallLogEntry {
  return {
    date: c.callDate,
    type: c.callType ?? undefined,
    summary: c.callSummary ?? undefined,
    key_updates: safeParse<string[]>(c.keyUpdates ?? '[]', []),
    attendees_client: safeParse<string[]>(c.attendeesClient ?? '[]', []),
    attendees_internal: safeParse<string[]>(c.attendeesInternal ?? '[]', []),
  };
}

function toBrainIcp(row: ReturnType<typeof getIcpProfile>): BrainICP {
  if (!row) return {};
  return {
    primary: row.primarySegment ?? undefined,
    secondary: row.secondarySegment ?? undefined,
    key_motivators: safeParse<string[]>(row.motivators ?? '[]', []),
    key_objections: safeParse<string[]>(row.objections ?? '[]', []),
    demographic_signals: safeParse<{ signal: string; confirmed?: boolean }[]>(
      row.demographicSignals ?? '[]',
      []
    ),
  };
}

// ─── Aggregate read: assemble the full ClientBrain from joined tables ───────

export function getClientBrain(clientId: string): ClientBrain {
  const c = getClient(clientId);
  if (!c) return EMPTY_BRAIN;

  const allConcerns = listConcerns(clientId);
  const allDeliverables = listDeliverables(clientId);
  const allContacts = listContacts(clientId);
  const callRows = listCalls(clientId);

  const lastCallRow = callRows[0];
  const lastUpdated = c.updatedAt ?? c.createdAt ?? null;

  return {
    client: c.name,
    pm: c.pmName ?? undefined,
    ad: c.adName ?? undefined,
    status: c.status ?? 'on-track',
    last_updated: lastUpdated ? new Date(lastUpdated).toISOString().slice(0, 10) : undefined,
    last_call: lastCallRow?.callDate,
    client_goals: listGoals(clientId).map(g => g.text),
    success_metric: c.successMetric ?? undefined,
    client_contacts: allContacts.filter(c => c.side === 'client').map(toBrainContact),
    internal_team: allContacts.filter(c => c.side === 'internal').map(toBrainContact),
    open_concerns: allConcerns.filter(x => x.status !== 'resolved').map(toBrainConcern),
    resolved_concerns: allConcerns.filter(x => x.status === 'resolved').map(toBrainConcern),
    our_deliverables: allDeliverables.filter(d => d.side === 'us').map(toBrainDeliverable),
    client_deliverables: allDeliverables.filter(d => d.side === 'client').map(toBrainDeliverable),
    decisions_made: listDecisions(clientId).map(d => d.text),
    wins: listWins(clientId).map(w => w.text),
    icp_notes: toBrainIcp(getIcpProfile(clientId)),
    documents: listDocuments(clientId).map(toBrainDocument),
    call_log: callRows.map(toBrainCallEntry),
  };
}

// ─── Quick stats (per-client and portfolio) ─────────────────────────────────

export type ClientStats = {
  goals: number;
  openConcerns: number;
  ourPending: number;
  theirPending: number;
  callCount: number;
  lastCallDate: string | null;
  wins: number;
};

const isPending = (s: string | null | undefined) => (s ?? 'pending').toLowerCase() !== 'done';

export function getClientStats(clientId: string): ClientStats {
  const callRows = listCalls(clientId);
  const allDeliverables = listDeliverables(clientId);
  return {
    goals: db.select().from(goals).where(eq(goals.clientId, clientId)).all().length,
    openConcerns: db.select().from(concerns).where(eq(concerns.clientId, clientId)).all()
      .filter(c => c.status !== 'resolved').length,
    ourPending: allDeliverables.filter(d => d.side === 'us' && isPending(d.status)).length,
    theirPending: allDeliverables.filter(d => d.side === 'client' && isPending(d.status)).length,
    callCount: callRows.length,
    lastCallDate: callRows[0]?.callDate ?? null,
    wins: db.select().from(wins).where(eq(wins.clientId, clientId)).all().length,
  };
}

/** Recent calls across all clients (for dashboard activity feed). */
export function listRecentCalls(limit = 5) {
  return db.select().from(calls).orderBy(desc(calls.callDate)).limit(limit).all();
}

/** Concerns flagged as a blocker for something (used by NeedsAttention). */
export function listBlockingConcerns(clientId: string) {
  return db
    .select()
    .from(concerns)
    .where(eq(concerns.clientId, clientId))
    .all()
    .filter(c => c.status !== 'resolved' && !!c.blockerFor);
}

/** Used by API route that lists calls but must strip coaching for stakeholders. */
export function listCallsSafe(clientId: string): Call[] {
  return listCalls(clientId).map(c => ({ ...c, coachingDoc: null }));
}
