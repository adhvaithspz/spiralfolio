/**
 * Type definitions for the assembled client brain — JSON returned by the API.
 */

export type BrainContact = {
  name: string;
  role?: string;
  is_approver?: boolean;
  notes?: string;
};

export type HistoryEntry = {
  at: string;
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
  client?: string;
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
  decisions_made?: string[];
  win_entries?: BrainWin[];
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
