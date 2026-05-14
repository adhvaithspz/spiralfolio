/**
 * Type definitions for the assembled client brain — the in-memory shape that
 * gets fed to AI prompts (synthesis, briefing) and to the UI.
 *
 * The brain is no longer stored as a single JSON blob. It's assembled from
 * normalized child tables on demand via lib/db/queries.ts → getClientBrain().
 * Keeping this shape stable means prompts and components don't need to change
 * just because the storage layer normalized.
 */

export type BrainContact = {
  name: string;
  role?: string;
  is_approver?: boolean;
  notes?: string;
};

/**
 * One row in a brain item's per-call history. Stored as JSON in the
 * `history` column on concerns / deliverables (and optionally legacy rows on wins/decisions).
 *
 * `kind` tells the UI what badge to render:
 *   - created   — initial extraction from a call
 *   - updated   — text/details/owner/due/blocker_for changed
 *   - status    — status moved (e.g. pending → in-progress)
 *   - completed — terminal state reached (deliverable done / concern resolved)
 *   - extended  — text body grew or was reworded based on a later call
 */
export type HistoryEntry = {
  at: string;             // ISO timestamp
  call_id?: string;
  call_date?: string;
  kind: 'created' | 'updated' | 'status' | 'completed' | 'extended';
  note?: string;
  prev_status?: string;
  new_status?: string;
  prev_text?: string;
  new_text?: string;
};

export type BrainConcern = {
  id?: string;
  concern: string;
  owner?: string;
  blocker_for?: string;
  status?: 'open' | 'in-progress' | 'resolved' | string;
  resolved_at?: string;
  updated_at?: string;
  last_updated_call_id?: string;
  history?: HistoryEntry[];
};

export type BrainDeliverable = {
  id?: string;
  item: string;
  details?: string;
  owner?: string;
  due?: string;
  status?: 'in-progress' | 'pending' | 'blocked' | 'done' | string;
  completed_at?: string;
  updated_at?: string;
  last_updated_call_id?: string;
  history?: HistoryEntry[];
};

export type BrainDecision = {
  id?: string;
  text: string;
  /** Call date this decision came from (for grouping); mirrors DB source_call_date */
  call_date?: string;
  call_id?: string;
  decided_at?: string;
  updated_at?: string;
  last_updated_call_id?: string;
  history?: HistoryEntry[];
};

export type BrainWin = {
  id?: string;
  text: string;
  call_date?: string;
  call_id?: string;
  won_at?: string;
  updated_at?: string;
  last_updated_call_id?: string;
  history?: HistoryEntry[];
};

export type BrainDocumentRef = {
  id?: string;
  name: string;
  type?: string;
  key_facts?: string[];
  flags?: string[];
};

/**
 * Per-call summary of brain mutations. Persisted on `calls.brain_changes`
 * and surfaced in the call timeline so PMs can see at a glance what each
 * call moved.
 */
export type CallChanges = {
  contacts_added: number;
  concerns_added: number;
  concerns_resolved: number;
  concerns_extended: number;
  deliverables_added: number;
  deliverables_completed: number;
  deliverables_extended: number;
  deliverables_status_changed: number;
  decisions_added: number;
  wins_added: number;
  // Free-form bullets describing each mutation for the call drawer
  notes?: string[];
};

export type BrainCallLogEntry = {
  id?: string;
  date: string;
  type?: string;
  summary?: string;
  key_updates?: string[];
  attendees_client?: string[];
  attendees_internal?: string[];
  changes?: CallChanges;
};

export type ClientBrain = {
  client?: string; // company/account name
  pm?: string;
  ad?: string;
  status?: string;
  last_updated?: string;
  last_call?: string;
  client_goals?: string[];
  success_metric?: string;
  client_contacts?: BrainContact[];
  internal_team?: BrainContact[];
  open_concerns?: BrainConcern[];
  resolved_concerns?: BrainConcern[];
  our_deliverables?: BrainDeliverable[];
  client_deliverables?: BrainDeliverable[];
  decisions?: BrainDecision[];
  /** @deprecated kept for back-compat with prompts; prefer `decisions` */
  decisions_made?: string[];
  win_entries?: BrainWin[];
  /** @deprecated kept for back-compat with prompts; prefer `win_entries` */
  wins?: string[];
  documents?: BrainDocumentRef[];
  call_log?: BrainCallLogEntry[];
};

export const EMPTY_BRAIN: ClientBrain = {
  client_goals: [],
  client_contacts: [],
  internal_team: [],
  open_concerns: [],
  resolved_concerns: [],
  our_deliverables: [],
  client_deliverables: [],
  decisions: [],
  decisions_made: [],
  win_entries: [],
  wins: [],
  documents: [],
  call_log: [],
};

