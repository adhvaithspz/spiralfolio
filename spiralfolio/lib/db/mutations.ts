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
 * client. Returns counts for the post-call summary card.
 */
export async function applyCallSynthesis(opts: {
  clientId: string;
  synthesis: CallSynthesis;
  at: Date;
}): Promise<{
  contactsAdded: number;
  concernsAdded: number;
  concernsResolved: number;
  deliverablesAdded: number;
  deliverablesUpdated: number;
  decisionsAdded: number;
  winsAdded: number;
}> {
  const { clientId, synthesis, at } = opts;

  let contactsAdded = 0;
  let concernsAdded = 0;
  let concernsResolved = 0;
  let deliverablesAdded = 0;
  let deliverablesUpdated = 0;
  let decisionsAdded = 0;
  let winsAdded = 0;

  // Fetch existing rows in parallel
  const [existingContacts, allConcerns, allDeliverables] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.clientId, clientId)),
    db.select().from(concerns).where(eq(concerns.clientId, clientId)),
    db.select().from(deliverables).where(eq(deliverables.clientId, clientId)),
  ]);

  // ── new client contacts (dedup on name+role) ──
  const contactKey = (n?: string | null, r?: string | null) => `${norm(n)}|${norm(r)}`;
  const haveContact = new Set(existingContacts.map(c => contactKey(c.name, c.role)));

  for (const nc of synthesis.new_contacts ?? []) {
    if (!nc.name) continue;
    const key = contactKey(nc.name, nc.role);
    if (haveContact.has(key)) continue;
    haveContact.add(key);
    await db.insert(contacts).values({
      id: nanoid(),
      clientId,
      name: nc.name,
      role: nc.role ?? null,
      isApprover: !!nc.is_approver,
      notes: nc.notes ?? null,
      side: 'client',
      createdAt: at,
    });
    contactsAdded++;
  }

  // ── concerns: resolve matching open ones, then insert new ──
  const openConcerns = allConcerns.filter(c => c.status !== 'resolved');

  for (const text of synthesis.resolved_concerns ?? []) {
    const target = norm(text);
    if (!target) continue;
    const match = openConcerns.find(c => {
      const cn = norm(c.concern);
      return cn === target || cn.includes(target) || target.includes(cn);
    });
    if (match) {
      await db.update(concerns).set({ status: 'resolved', resolvedAt: at }).where(eq(concerns.id, match.id));
      match.status = 'resolved';
      concernsResolved++;
    }
  }

  for (const nc of synthesis.new_concerns ?? []) {
    if (!nc.concern) continue;
    await db.insert(concerns).values({
      id: nanoid(),
      clientId,
      concern: nc.concern,
      owner: nc.owner ?? null,
      blockerFor: nc.blocker_for ?? null,
      status: (nc.status as 'open' | 'in-progress' | 'resolved' | undefined) ?? 'open',
      createdAt: at,
    });
    concernsAdded++;
  }

  // ── deliverables: updates first, then inserts ──
  const delivByItem = new Map(allDeliverables.map(d => [norm(d.item), d]));

  for (const upd of synthesis.updated_deliverables ?? []) {
    if (!upd.item || !upd.new_status) continue;
    const match = delivByItem.get(norm(upd.item));
    if (match) {
      await db.update(deliverables).set({ status: upd.new_status, updatedAt: at }).where(eq(deliverables.id, match.id));
      deliverablesUpdated++;
    }
  }

  const insertDeliverable = async (
    item: string,
    side: 'us' | 'client',
    extras: { details?: string | null; owner?: string | null; due?: string | null; status?: string | null }
  ) => {
    if (!item) return;
    const key = norm(item);
    if (delivByItem.has(key)) return;
    const id = nanoid();
    await db.insert(deliverables).values({
      id,
      clientId,
      item,
      details: extras.details ?? null,
      owner: extras.owner ?? null,
      due: extras.due ?? null,
      status: extras.status ?? 'pending',
      side,
      createdAt: at,
      updatedAt: at,
    });
    deliverablesAdded++;
    delivByItem.set(key, {
      id,
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
    await insertDeliverable(d.item, 'us', { details: d.details, status: d.status });
  }
  for (const d of synthesis.new_client_deliverables ?? []) {
    await insertDeliverable(d.item, 'client', { owner: d.owner, due: d.due });
  }

  // ── decisions & wins: append-only ──
  for (const text of synthesis.decisions_made ?? []) {
    if (!text) continue;
    await db.insert(decisions).values({ id: nanoid(), clientId, text, decidedAt: at });
    decisionsAdded++;
  }
  for (const text of synthesis.wins ?? []) {
    if (!text) continue;
    await db.insert(wins).values({ id: nanoid(), clientId, text, wonAt: at });
    winsAdded++;
  }

  // bump client.updated_at so dashboards re-sort
  await db.update(clients).set({ updatedAt: at }).where(eq(clients.id, clientId));

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
 * Imports a full ClientBrain into the normalized tables.
 * Used by seed scripts. Caller is responsible for idempotency.
 */
export async function importBrainIntoTables(opts: {
  clientId: string;
  brain: ClientBrain;
  at?: Date;
}): Promise<void> {
  const at = opts.at ?? new Date();
  const { clientId, brain } = opts;

  for (const [i, text] of (brain.client_goals ?? []).entries()) {
    await db.insert(goals).values({ id: nanoid(), clientId, text, position: i, createdAt: at });
  }

  for (const c of brain.client_contacts ?? []) {
    await db.insert(contacts).values({
      id: nanoid(),
      clientId,
      name: c.name,
      role: c.role ?? null,
      isApprover: !!c.is_approver,
      notes: c.notes ?? null,
      side: 'client',
      createdAt: at,
    });
  }
  for (const c of brain.internal_team ?? []) {
    await db.insert(contacts).values({
      id: nanoid(),
      clientId,
      name: c.name,
      role: c.role ?? null,
      isApprover: !!c.is_approver,
      notes: c.notes ?? null,
      side: 'internal',
      createdAt: at,
    });
  }

  for (const c of brain.open_concerns ?? []) {
    await db.insert(concerns).values({
      id: nanoid(),
      clientId,
      concern: c.concern,
      owner: c.owner ?? null,
      blockerFor: c.blocker_for ?? null,
      status: (c.status as 'open' | 'in-progress' | 'resolved') ?? 'open',
      createdAt: at,
    });
  }
  for (const c of brain.resolved_concerns ?? []) {
    await db.insert(concerns).values({
      id: nanoid(),
      clientId,
      concern: c.concern,
      owner: c.owner ?? null,
      blockerFor: c.blocker_for ?? null,
      status: 'resolved',
      resolvedAt: at,
      createdAt: at,
    });
  }

  for (const d of brain.our_deliverables ?? []) {
    await db.insert(deliverables).values({
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
    });
  }
  for (const d of brain.client_deliverables ?? []) {
    await db.insert(deliverables).values({
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
    });
  }

  for (const text of brain.decisions_made ?? []) {
    await db.insert(decisions).values({ id: nanoid(), clientId, text, decidedAt: at });
  }
  for (const text of brain.wins ?? []) {
    await db.insert(wins).values({ id: nanoid(), clientId, text, wonAt: at });
  }

  if (brain.icp_notes && Object.keys(brain.icp_notes).length > 0) {
    const icp = brain.icp_notes;
    await db.insert(icpProfile).values({
      clientId,
      primarySegment: icp.primary ?? null,
      secondarySegment: icp.secondary ?? null,
      motivators: safeStringify(icp.key_motivators ?? []),
      objections: safeStringify(icp.key_objections ?? []),
      demographicSignals: safeStringify(icp.demographic_signals ?? []),
      updatedAt: at,
    });
  }

  for (const entry of brain.call_log ?? []) {
    await db.insert(calls).values({
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
    });
  }
}
