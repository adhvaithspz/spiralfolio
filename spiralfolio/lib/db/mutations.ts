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
  wins,
} from './schema';
import { nanoid } from '@/lib/utils/nanoid';
import type { ClientBrain, HistoryEntry, CallChanges } from './brain';
import type { CallSynthesis, RefMap } from '@/lib/ai/synthesis';
import { safeParse, safeStringify } from '@/lib/utils/json';

const norm = (s: string | undefined | null) => (s ?? '').trim().toLowerCase();

const DEFAULT_CHANGES: CallChanges = {
  contacts_added: 0,
  concerns_added: 0,
  concerns_resolved: 0,
  concerns_extended: 0,
  deliverables_added: 0,
  deliverables_completed: 0,
  deliverables_extended: 0,
  deliverables_status_changed: 0,
  decisions_added: 0,
  wins_added: 0,
  notes: [],
};

function appendHistory(existing: string | null | undefined, entry: HistoryEntry): string {
  const arr = safeParse<HistoryEntry[]>(existing ?? '[]', []);
  arr.push(entry);
  return safeStringify(arr);
}

/**
 * Applies a per-call synthesis output to the normalized child tables for one
 * client.
 *
 * Concerns & deliverables: refs (C*, D*) resolve to DB ids for resolve / extend /
 * complete; each mutation appends HistoryEntry and stamps lastUpdatedCallId.
 *
 * Decisions & wins: append-only rows per call with sourceCallDate / sourceCallId
 * for grouping in the UI (no merging into prior rows).
 *
 * Returns CallChanges persisted on the call row for the timeline summary.
 */
export async function applyCallSynthesis(opts: {
  clientId: string;
  synthesis: CallSynthesis;
  refs: RefMap;
  callId: string;
  callDate: string;
  at: Date;
}): Promise<CallChanges> {
  const { clientId, synthesis, refs, callId, callDate, at } = opts;
  const changes: CallChanges = { ...DEFAULT_CHANGES, notes: [] };
  const baseHistory = { at: at.toISOString(), call_id: callId, call_date: callDate };

  const [existingContacts, allConcerns, allDeliverables] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.clientId, clientId)),
    db.select().from(concerns).where(eq(concerns.clientId, clientId)),
    db.select().from(deliverables).where(eq(deliverables.clientId, clientId)),
  ]);

  const concernById = new Map(allConcerns.map(c => [c.id, c]));
  const delivById = new Map(allDeliverables.map(d => [d.id, d]));

  // ── Contacts (dedup on name+role) ──────────────────────────────────────────
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
    changes.contacts_added++;
  }

  // ── Concerns: resolve → extend → add ───────────────────────────────────────

  // resolved_concerns can come with a ref (preferred) or a text fallback.
  for (const r of synthesis.resolved_concerns ?? []) {
    let target = r.ref ? concernById.get(refs.concerns.get(r.ref) ?? '') : undefined;
    if (!target && r.text) {
      const t = norm(r.text);
      target = allConcerns.find(c => c.status !== 'resolved' && (norm(c.concern) === t || norm(c.concern).includes(t) || t.includes(norm(c.concern))));
    }
    if (!target || target.status === 'resolved') continue;
    const prevStatus = target.status;
    const history = appendHistory(target.history, {
      ...baseHistory,
      kind: 'completed',
      prev_status: prevStatus,
      new_status: 'resolved',
      note: r.note,
    });
    await db
      .update(concerns)
      .set({ status: 'resolved', resolvedAt: at, updatedAt: at, lastUpdatedCallId: callId, history })
      .where(eq(concerns.id, target.id));
    target.status = 'resolved';
    target.resolvedAt = at;
    target.history = history;
    changes.concerns_resolved++;
    changes.notes!.push(`Resolved concern: ${target.concern}`);
  }

  for (const upd of synthesis.updated_concerns ?? []) {
    const target = upd.ref ? concernById.get(refs.concerns.get(upd.ref) ?? '') : undefined;
    if (!target) continue;
    const patch: Partial<typeof target> & { history?: string } = {};
    let kind: HistoryEntry['kind'] = 'updated';
    let prevStatus: string | undefined;
    let newStatus: string | undefined;
    if (upd.new_status && upd.new_status !== target.status) {
      prevStatus = target.status;
      newStatus = upd.new_status;
      patch.status = upd.new_status as typeof target.status;
      kind = 'status';
    }
    if (upd.new_owner !== undefined && upd.new_owner !== (target.owner ?? '')) patch.owner = upd.new_owner || null;
    if (upd.new_blocker_for !== undefined && upd.new_blocker_for !== (target.blockerFor ?? '')) {
      patch.blockerFor = upd.new_blocker_for || null;
    }
    if (Object.keys(patch).length === 0 && !upd.change_note) continue;
    const history = appendHistory(target.history, {
      ...baseHistory,
      kind,
      prev_status: prevStatus,
      new_status: newStatus,
      note: upd.change_note,
    });
    await db
      .update(concerns)
      .set({ ...patch, updatedAt: at, lastUpdatedCallId: callId, history })
      .where(eq(concerns.id, target.id));
    Object.assign(target, patch, { updatedAt: at, history });
    changes.concerns_extended++;
    changes.notes!.push(`Extended concern: ${target.concern}${upd.change_note ? ` — ${upd.change_note}` : ''}`);
  }

  for (const nc of synthesis.new_concerns ?? []) {
    if (!nc.concern) continue;
    const id = nanoid();
    const history = appendHistory(null, {
      ...baseHistory,
      kind: 'created',
    });
    await db.insert(concerns).values({
      id,
      clientId,
      concern: nc.concern,
      owner: nc.owner ?? null,
      blockerFor: nc.blocker_for ?? null,
      status: (nc.status as 'open' | 'in-progress' | 'resolved' | undefined) ?? 'open',
      createdAt: at,
      updatedAt: at,
      lastUpdatedCallId: callId,
      history,
    });
    changes.concerns_added++;
  }

  // ── Deliverables: complete → extend → add ──────────────────────────────────

  for (const c of synthesis.completed_deliverables ?? []) {
    const target = c.ref ? delivById.get(refs.deliverables.get(c.ref) ?? '') : undefined;
    if (!target || target.status === 'done') continue;
    const prevStatus = target.status;
    const history = appendHistory(target.history, {
      ...baseHistory,
      kind: 'completed',
      prev_status: prevStatus,
      new_status: 'done',
      note: c.note,
    });
    await db
      .update(deliverables)
      .set({ status: 'done', completedAt: at, updatedAt: at, lastUpdatedCallId: callId, history })
      .where(eq(deliverables.id, target.id));
    target.status = 'done';
    target.completedAt = at;
    target.history = history;
    changes.deliverables_completed++;
    changes.notes!.push(`Completed deliverable: ${target.item}`);
  }

  for (const upd of synthesis.updated_deliverables ?? []) {
    const target = upd.ref ? delivById.get(refs.deliverables.get(upd.ref) ?? '') : undefined;
    if (!target) continue;
    const patch: Partial<typeof target> & { history?: string } = {};
    let kind: HistoryEntry['kind'] = 'updated';
    let prevStatus: string | undefined;
    let newStatus: string | undefined;
    if (upd.new_status && upd.new_status !== target.status) {
      prevStatus = target.status;
      newStatus = upd.new_status;
      patch.status = upd.new_status as typeof target.status;
      kind = 'status';
      if (upd.new_status === 'done') {
        // Status moves to done are still "extended"; explicit completion
        // should come via completed_deliverables, but treat this as a complete too.
        patch.completedAt = at;
        kind = 'completed';
        changes.deliverables_completed++;
      } else {
        changes.deliverables_status_changed++;
      }
    }
    if (upd.new_details !== undefined && upd.new_details !== (target.details ?? '')) patch.details = upd.new_details || null;
    if (upd.new_owner !== undefined && upd.new_owner !== (target.owner ?? '')) patch.owner = upd.new_owner || null;
    if (upd.new_due !== undefined && upd.new_due !== (target.due ?? '')) patch.due = upd.new_due || null;
    if (Object.keys(patch).length === 0 && !upd.change_note) continue;
    const history = appendHistory(target.history, {
      ...baseHistory,
      kind,
      prev_status: prevStatus,
      new_status: newStatus,
      note: upd.change_note,
    });
    await db
      .update(deliverables)
      .set({ ...patch, updatedAt: at, lastUpdatedCallId: callId, history })
      .where(eq(deliverables.id, target.id));
    Object.assign(target, patch, { updatedAt: at, history });
    if (kind !== 'completed') {
      changes.deliverables_extended++;
      changes.notes!.push(`Extended deliverable: ${target.item}${upd.change_note ? ` — ${upd.change_note}` : ''}`);
    } else {
      changes.notes!.push(`Completed deliverable: ${target.item}`);
    }
  }

  // dedup new deliverables against EXISTING items by normalized text — protects
  // us if the AI drops a ref and re-emits the same item as "new".
  const delivByItem = new Map(allDeliverables.map(d => [norm(d.item), d]));
  const insertDeliverable = async (
    item: string,
    side: 'us' | 'client',
    extras: { details?: string | null; owner?: string | null; due?: string | null; status?: string | null },
  ) => {
    if (!item) return;
    const key = norm(item);
    if (delivByItem.has(key)) return;
    const id = nanoid();
    const history = appendHistory(null, { ...baseHistory, kind: 'created' });
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
      lastUpdatedCallId: callId,
      history,
    });
    changes.deliverables_added++;
    delivByItem.set(key, {
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
      completedAt: null,
      lastUpdatedCallId: callId,
      history,
    });
  };
  for (const d of synthesis.new_our_deliverables ?? []) {
    await insertDeliverable(d.item, 'us', { details: d.details, status: d.status });
  }
  for (const d of synthesis.new_client_deliverables ?? []) {
    await insertDeliverable(d.item, 'client', { owner: d.owner, due: d.due, status: d.status });
  }

  // ── Decisions & wins: append-only (grouped by call date in UI) ─────────────
  const dedupeBatch = new Set<string>();
  for (const text of synthesis.new_decisions ?? []) {
    const k = norm(text);
    if (!text || dedupeBatch.has(`d:${k}`)) continue;
    dedupeBatch.add(`d:${k}`);
    const history = appendHistory(null, { ...baseHistory, kind: 'created' });
    await db.insert(decisions).values({
      id: nanoid(),
      clientId,
      text,
      decidedAt: at,
      updatedAt: at,
      lastUpdatedCallId: callId,
      sourceCallDate: callDate,
      sourceCallId: callId,
      history,
    });
    changes.decisions_added++;
    changes.notes!.push(`Decision: ${text}`);
  }
  for (const text of synthesis.new_wins ?? []) {
    const k = norm(text);
    if (!text || dedupeBatch.has(`w:${k}`)) continue;
    dedupeBatch.add(`w:${k}`);
    const history = appendHistory(null, { ...baseHistory, kind: 'created' });
    await db.insert(wins).values({
      id: nanoid(),
      clientId,
      text,
      wonAt: at,
      updatedAt: at,
      lastUpdatedCallId: callId,
      sourceCallDate: callDate,
      sourceCallId: callId,
      history,
    });
    changes.wins_added++;
    changes.notes!.push(`Win: ${text}`);
  }

  await db.update(clients).set({ updatedAt: at }).where(eq(clients.id, clientId));
  return changes;
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
