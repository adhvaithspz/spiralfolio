import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from './index';
import {
  calls,
  clients,
  concerns,
  contacts,
  decisions,
  deliverables,
  goals,
  icpProfile,
  wins,
} from './schema';
import { nanoid } from '@/lib/utils/nanoid';
import type { ClientBrain } from './brain';
import type { CallSynthesis } from '@/lib/ai/synthesis';
import { safeStringify } from '@/lib/utils/json';

const norm = (s: string | undefined | null) => (s ?? '').trim().toLowerCase();

/**
 * Applies a per-call synthesis output to the normalized child tables for one
 * client. Operations:
 *   - new contacts → insert (dedup by name+role, case-insensitive)
 *   - resolved concerns → mark matching open concerns as resolved
 *   - new concerns → insert
 *   - updated deliverables → update status by item-name match
 *   - new our/client deliverables → insert (dedup by item, case-insensitive)
 *   - decisions → insert (append-only)
 *   - wins → insert (append-only)
 * Returns counts for the post-call summary card.
 */
export function applyCallSynthesis(opts: {
  clientId: string;
  synthesis: CallSynthesis;
  at: Date;
}): {
  contactsAdded: number;
  concernsAdded: number;
  concernsResolved: number;
  deliverablesAdded: number;
  deliverablesUpdated: number;
  decisionsAdded: number;
  winsAdded: number;
} {
  const { clientId, synthesis, at } = opts;

  let contactsAdded = 0;
  let concernsAdded = 0;
  let concernsResolved = 0;
  let deliverablesAdded = 0;
  let deliverablesUpdated = 0;
  let decisionsAdded = 0;
  let winsAdded = 0;

  // ── new client contacts (dedup on name+role) ──
  const existingContacts = db.select().from(contacts).where(eq(contacts.clientId, clientId)).all();
  const contactKey = (n?: string | null, r?: string | null) => `${norm(n)}|${norm(r)}`;
  const haveContact = new Set(existingContacts.map(c => contactKey(c.name, c.role)));

  for (const nc of synthesis.new_contacts ?? []) {
    if (!nc.name) continue;
    const key = contactKey(nc.name, nc.role);
    if (haveContact.has(key)) continue;
    haveContact.add(key);
    db.insert(contacts)
      .values({
        id: nanoid(),
        clientId,
        name: nc.name,
        role: nc.role ?? null,
        isApprover: !!nc.is_approver,
        notes: nc.notes ?? null,
        side: 'client',
        createdAt: at,
      })
      .run();
    contactsAdded++;
  }

  // ── concerns: resolve matching open ones first, then insert new ──
  const openConcerns = db.select().from(concerns).where(eq(concerns.clientId, clientId)).all()
    .filter(c => c.status !== 'resolved');

  for (const text of synthesis.resolved_concerns ?? []) {
    const target = norm(text);
    if (!target) continue;
    const match = openConcerns.find(c => {
      const cn = norm(c.concern);
      return cn === target || cn.includes(target) || target.includes(cn);
    });
    if (match) {
      db.update(concerns)
        .set({ status: 'resolved', resolvedAt: at })
        .where(eq(concerns.id, match.id))
        .run();
      match.status = 'resolved'; // keep local copy in sync so we don't double-match
      concernsResolved++;
    }
  }

  for (const nc of synthesis.new_concerns ?? []) {
    if (!nc.concern) continue;
    db.insert(concerns)
      .values({
        id: nanoid(),
        clientId,
        concern: nc.concern,
        owner: nc.owner ?? null,
        blockerFor: nc.blocker_for ?? null,
        status: (nc.status as 'open' | 'in-progress' | 'resolved' | undefined) ?? 'open',
        createdAt: at,
      })
      .run();
    concernsAdded++;
  }

  // ── deliverables: updates first (match by item, case-insensitive), then inserts ──
  const allDeliverables = db.select().from(deliverables).where(eq(deliverables.clientId, clientId)).all();
  const delivByItem = new Map(allDeliverables.map(d => [norm(d.item), d]));

  for (const upd of synthesis.updated_deliverables ?? []) {
    if (!upd.item || !upd.new_status) continue;
    const match = delivByItem.get(norm(upd.item));
    if (match) {
      db.update(deliverables)
        .set({ status: upd.new_status, updatedAt: at })
        .where(eq(deliverables.id, match.id))
        .run();
      deliverablesUpdated++;
    }
  }

  const insertDeliverable = (
    item: string,
    side: 'us' | 'client',
    extras: { details?: string | null; owner?: string | null; due?: string | null; status?: string | null }
  ) => {
    if (!item) return;
    const key = norm(item);
    if (delivByItem.has(key)) return;
    db.insert(deliverables)
      .values({
        id: nanoid(),
        clientId,
        item,
        details: extras.details ?? null,
        owner: extras.owner ?? null,
        due: extras.due ?? null,
        status: extras.status ?? 'pending',
        side,
        createdAt: at,
        updatedAt: at,
      })
      .run();
    deliverablesAdded++;
    delivByItem.set(key, {
      id: nanoid(),
      clientId,
      item,
      details: null,
      owner: null,
      due: null,
      status: extras.status ?? 'pending',
      side,
      createdAt: at,
      updatedAt: at,
    });
  };

  for (const d of synthesis.new_our_deliverables ?? []) {
    insertDeliverable(d.item, 'us', { details: d.details, status: d.status });
  }
  for (const d of synthesis.new_client_deliverables ?? []) {
    insertDeliverable(d.item, 'client', { owner: d.owner, due: d.due });
  }

  // ── decisions & wins: append-only ──
  for (const text of synthesis.decisions_made ?? []) {
    if (!text) continue;
    db.insert(decisions).values({ id: nanoid(), clientId, text, decidedAt: at }).run();
    decisionsAdded++;
  }
  for (const text of synthesis.wins ?? []) {
    if (!text) continue;
    db.insert(wins).values({ id: nanoid(), clientId, text, wonAt: at }).run();
    winsAdded++;
  }

  // bump client.updated_at so dashboards re-sort
  db.update(clients).set({ updatedAt: at }).where(eq(clients.id, clientId)).run();

  return {
    contactsAdded,
    concernsAdded,
    concernsResolved,
    deliverablesAdded,
    deliverablesUpdated,
    decisionsAdded,
    winsAdded,
  };
}

/**
 * Imports a full ClientBrain (e.g. from seed data) into the normalized tables.
 * Used by scripts/seed.ts and by tests. Idempotency is the caller's problem —
 * this writes everything blindly.
 */
export function importBrainIntoTables(opts: {
  clientId: string;
  brain: ClientBrain;
  at?: Date;
}): void {
  const at = opts.at ?? new Date();
  const { clientId, brain } = opts;

  (brain.client_goals ?? []).forEach((text, i) => {
    db.insert(goals).values({ id: nanoid(), clientId, text, position: i, createdAt: at }).run();
  });

  for (const c of brain.client_contacts ?? []) {
    db.insert(contacts)
      .values({
        id: nanoid(),
        clientId,
        name: c.name,
        role: c.role ?? null,
        isApprover: !!c.is_approver,
        notes: c.notes ?? null,
        side: 'client',
        createdAt: at,
      })
      .run();
  }
  for (const c of brain.internal_team ?? []) {
    db.insert(contacts)
      .values({
        id: nanoid(),
        clientId,
        name: c.name,
        role: c.role ?? null,
        isApprover: !!c.is_approver,
        notes: c.notes ?? null,
        side: 'internal',
        createdAt: at,
      })
      .run();
  }

  for (const c of brain.open_concerns ?? []) {
    db.insert(concerns)
      .values({
        id: nanoid(),
        clientId,
        concern: c.concern,
        owner: c.owner ?? null,
        blockerFor: c.blocker_for ?? null,
        status: (c.status as 'open' | 'in-progress' | 'resolved') ?? 'open',
        createdAt: at,
      })
      .run();
  }
  for (const c of brain.resolved_concerns ?? []) {
    db.insert(concerns)
      .values({
        id: nanoid(),
        clientId,
        concern: c.concern,
        owner: c.owner ?? null,
        blockerFor: c.blocker_for ?? null,
        status: 'resolved',
        resolvedAt: at,
        createdAt: at,
      })
      .run();
  }

  for (const d of brain.our_deliverables ?? []) {
    db.insert(deliverables)
      .values({
        id: nanoid(),
        clientId,
        item: d.item,
        details: d.details ?? null,
        owner: d.owner ?? null,
        due: d.due ?? null,
        status: d.status ?? 'pending',
        side: 'us',
        createdAt: at,
        updatedAt: at,
      })
      .run();
  }
  for (const d of brain.client_deliverables ?? []) {
    db.insert(deliverables)
      .values({
        id: nanoid(),
        clientId,
        item: d.item,
        details: d.details ?? null,
        owner: d.owner ?? null,
        due: d.due ?? null,
        status: d.status ?? 'pending',
        side: 'client',
        createdAt: at,
        updatedAt: at,
      })
      .run();
  }

  for (const text of brain.decisions_made ?? []) {
    db.insert(decisions).values({ id: nanoid(), clientId, text, decidedAt: at }).run();
  }
  for (const text of brain.wins ?? []) {
    db.insert(wins).values({ id: nanoid(), clientId, text, wonAt: at }).run();
  }

  if (brain.icp_notes && Object.keys(brain.icp_notes).length > 0) {
    const icp = brain.icp_notes;
    db.insert(icpProfile)
      .values({
        clientId,
        primarySegment: icp.primary ?? null,
        secondarySegment: icp.secondary ?? null,
        motivators: safeStringify(icp.key_motivators ?? []),
        objections: safeStringify(icp.key_objections ?? []),
        demographicSignals: safeStringify(icp.demographic_signals ?? []),
        updatedAt: at,
      })
      .run();
  }

  // call_log entries → write to calls table
  for (const entry of brain.call_log ?? []) {
    db.insert(calls)
      .values({
        id: nanoid(),
        clientId,
        callDate: entry.date,
        callType: entry.type ?? null,
        callSummary: entry.summary ?? null,
        keyUpdates: safeStringify(entry.key_updates ?? []),
        attendeesClient: safeStringify(entry.attendees_client ?? []),
        attendeesInternal: safeStringify(entry.attendees_internal ?? []),
        status: 'done',
        createdAt: new Date(entry.date),
      })
      .run();
  }
}
