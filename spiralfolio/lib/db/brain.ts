/**
 * Type definitions for the assembled client brain — the in-memory shape that
 * gets fed to AI prompts (synthesis, briefing, coaching) and to the UI.
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

export type BrainConcern = {
  concern: string;
  owner?: string;
  blocker_for?: string;
  status?: 'open' | 'in-progress' | 'resolved' | string;
};

export type BrainDeliverable = {
  item: string;
  details?: string;
  owner?: string;
  due?: string;
  status?: 'in-progress' | 'pending' | 'blocked' | 'done' | string;
};

export type BrainDocumentRef = {
  id?: string;
  name: string;
  type?: string;
  key_facts?: string[];
  flags?: string[];
};

export type BrainCallLogEntry = {
  date: string;
  type?: string;
  summary?: string;
  key_updates?: string[];
  attendees_client?: string[];
  attendees_internal?: string[];
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
  decisions_made?: string[];
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
  decisions_made: [],
  wins: [],
  documents: [],
  call_log: [],
};

