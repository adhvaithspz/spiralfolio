import 'server-only';
import { asc, count, desc, eq, max, ne } from 'drizzle-orm';
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
  type ClientBrain,
} from './brain';
import { safeParse } from '@/lib/utils/json';

// ─── Single-table reads ──────────────────────────────────────────────────────

export async function getClient(id: string): Promise<Client | undefined> {
  const [row] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return row;
}

export async function listClients(): Promise<Client[]> {
  return db.select().from(clients).orderBy(desc(clients.updatedAt));
}

export async function listGoals(clientId: string) {
  return db.select().from(goals).where(eq(goals.clientId, clientId)).orderBy(asc(goals.position));
}

export async function listContacts(clientId: string): Promise<Contact[]> {
  return db.select().from(contacts).where(eq(contacts.clientId, clientId)).orderBy(asc(contacts.createdAt));
}

export async function listConcerns(clientId: string): Promise<Concern[]> {
  return db.select().from(concerns).where(eq(concerns.clientId, clientId)).orderBy(asc(concerns.createdAt));
}

export async function listDeliverables(clientId: string): Promise<Deliverable[]> {
  return db
    .select()
    .from(deliverables)
    .where(eq(deliverables.clientId, clientId))
    .orderBy(asc(deliverables.createdAt));
}

export async function listDecisions(clientId: string) {
  return db.select().from(decisions).where(eq(decisions.clientId, clientId)).orderBy(desc(decisions.decidedAt));
}

export async function listWins(clientId: string) {
  return db.select().from(wins).where(eq(wins.clientId, clientId)).orderBy(desc(wins.wonAt));
}


export async function listDocuments(clientId: string): Promise<Document[]> {
  return db
    .select()
    .from(documents)
    .where(eq(documents.clientId, clientId))
    .orderBy(desc(documents.ingestedAt));
}

export async function listCalls(clientId: string): Promise<Call[]> {
  return db.select().from(calls).where(eq(calls.clientId, clientId)).orderBy(desc(calls.callDate));
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


// ─── Aggregate read: assemble the full ClientBrain from joined tables ────────

export async function getClientBrain(clientId: string): Promise<ClientBrain> {
  // Parallelise getClient alongside all child queries — no serial hop.
  const [
    c,
    goalRows,
    allContacts,
    allConcerns,
    allDeliverables,
    decisionRows,
    winRows,
    docRows,
    callRows,
  ] = await Promise.all([
    getClient(clientId),
    listGoals(clientId),
    listContacts(clientId),
    listConcerns(clientId),
    listDeliverables(clientId),
    listDecisions(clientId),
    listWins(clientId),
    listDocuments(clientId),
    listCalls(clientId),
  ]);

  if (!c) return EMPTY_BRAIN;

  const lastCallRow = callRows[0];
  const lastUpdated = c.updatedAt ?? c.createdAt ?? null;

  return {
    client: c.name,
    pm: c.pmName ?? undefined,
    ad: c.adName ?? undefined,
    status: c.status ?? 'on-track',
    last_updated: lastUpdated ? new Date(lastUpdated).toISOString().slice(0, 10) : undefined,
    last_call: lastCallRow?.callDate,
    client_goals: goalRows.map(g => g.text),
    success_metric: c.successMetric ?? undefined,
    client_contacts: allContacts.filter(c => c.side === 'client').map(toBrainContact),
    internal_team: allContacts.filter(c => c.side === 'internal').map(toBrainContact),
    open_concerns: allConcerns.filter(x => x.status !== 'resolved').map(toBrainConcern),
    resolved_concerns: allConcerns.filter(x => x.status === 'resolved').map(toBrainConcern),
    our_deliverables: allDeliverables.filter(d => d.side === 'us').map(toBrainDeliverable),
    client_deliverables: allDeliverables.filter(d => d.side === 'client').map(toBrainDeliverable),
    decisions_made: decisionRows.map(d => d.text),
    wins: winRows.map(w => w.text),
    documents: docRows.map(toBrainDocument),
    call_log: callRows.map(toBrainCallEntry),
  };
}

// ─── Quick stats ─────────────────────────────────────────────────────────────

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

export async function getClientStats(clientId: string): Promise<ClientStats> {
  const [goalRows, concernRows, delivRows, callRows, winRows] = await Promise.all([
    listGoals(clientId),
    listConcerns(clientId),
    listDeliverables(clientId),
    listCalls(clientId),
    listWins(clientId),
  ]);
  return {
    goals: goalRows.length,
    openConcerns: concernRows.filter(c => c.status !== 'resolved').length,
    ourPending: delivRows.filter(d => d.side === 'us' && isPending(d.status)).length,
    theirPending: delivRows.filter(d => d.side === 'client' && isPending(d.status)).length,
    callCount: callRows.length,
    lastCallDate: callRows[0]?.callDate ?? null,
    wins: winRows.length,
  };
}

/** Recent calls across all clients (for dashboard activity feed). */
export async function listRecentCalls(limit = 5): Promise<Call[]> {
  return db.select().from(calls).orderBy(desc(calls.callDate)).limit(limit);
}

/** Concerns flagged as a blocker for something (used by NeedsAttention). */
export async function listBlockingConcerns(clientId: string) {
  const all = await listConcerns(clientId);
  return all.filter(c => c.status !== 'resolved' && !!c.blockerFor);
}

/** Used by API route that lists calls but must strip coaching for stakeholders. */
export async function listCallsSafe(clientId: string): Promise<Call[]> {
  const rows = await listCalls(clientId);
  return rows.map(c => ({ ...c, coachingDoc: null }));
}

/**
 * Single-shot dashboard load: 3 HTTP requests instead of 1 + (N × 10).
 * Fetches all clients, then aggregates open-concern counts and latest call
 * dates in two parallel GROUP BY queries — no per-client round trips.
 */
export async function getDashboardData(): Promise<
  Array<{ client: Client; stats: import('@/lib/brain-stats').BrainStats }>
> {
  const [allClients, concernCounts, lastCalls] = await Promise.all([
    db.select().from(clients).orderBy(desc(clients.updatedAt)),
    db
      .select({ clientId: concerns.clientId, n: count() })
      .from(concerns)
      .where(ne(concerns.status, 'resolved'))
      .groupBy(concerns.clientId),
    db
      .select({ clientId: calls.clientId, lastDate: max(calls.callDate) })
      .from(calls)
      .groupBy(calls.clientId),
  ]);

  const concernMap = new Map(concernCounts.map(r => [r.clientId, r.n]));
  const callMap = new Map(lastCalls.map(r => [r.clientId, r.lastDate ?? null]));

  return allClients.map(client => ({
    client,
    stats: {
      goals: 0,
      openConcerns: concernMap.get(client.id) ?? 0,
      ourPending: 0,
      theirPending: 0,
      callCount: 0,
      lastCallDate: callMap.get(client.id) ?? null,
    },
  }));
}
