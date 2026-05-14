import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * The "client" entity is the unit of work. Each row represents one ongoing
 * client account / engagement. The brain (goals, contacts, concerns, etc.)
 * lives in dedicated child tables keyed by client_id — see queries.ts for the
 * assembled shape (`ClientBrain`) used by the UI and AI prompts.
 */

export const clients = sqliteTable('clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(), // e.g. "32Auctions" — the company/account name
  engagement: text('engagement'), // e.g. "32Auctions CRO Pilot" — optional subtitle
  pmName: text('pm_name'),
  adName: text('ad_name'),
  status: text('status').default('on-track'), // on-track | at-risk | blocked | complete
  successMetric: text('success_metric'),
  driveFolderUrl: text('drive_folder_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  position: integer('position').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  role: text('role'),
  isApprover: integer('is_approver', { mode: 'boolean' }).default(false),
  notes: text('notes'),
  side: text('side').notNull().default('client'), // 'client' | 'internal'
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const concerns = sqliteTable('concerns', {
  id: text('id').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  concern: text('concern').notNull(),
  owner: text('owner'),
  blockerFor: text('blocker_for'),
  status: text('status').notNull().default('open'), // 'open' | 'in-progress' | 'resolved'
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const deliverables = sqliteTable('deliverables', {
  id: text('id').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  item: text('item').notNull(),
  details: text('details'),
  owner: text('owner'),
  due: text('due'), // free-form text per PRD ("ASAP", "before next call", or ISO date)
  status: text('status').notNull().default('pending'), // 'in-progress' | 'pending' | 'blocked' | 'done'
  side: text('side').notNull(), // 'us' | 'client'
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const decisions = sqliteTable('decisions', {
  id: text('id').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  decidedAt: integer('decided_at', { mode: 'timestamp' }),
});

export const wins = sqliteTable('wins', {
  id: text('id').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  wonAt: integer('won_at', { mode: 'timestamp' }),
});


export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name'),
  driveFileId: text('drive_file_id'),
  docType: text('doc_type'),
  keyFacts: text('key_facts').default('[]'), // JSON string[]
  flags: text('flags').default('[]'), // JSON string[]
  ingestedAt: integer('ingested_at', { mode: 'timestamp' }),
});

export const calls = sqliteTable('calls', {
  id: text('id').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'cascade' }),
  callDate: text('call_date').notNull(), // ISO date string
  callType: text('call_type'), // kickoff | weekly | ad-hoc | review
  rawTranscript: text('raw_transcript'),
  coachingDoc: text('coaching_doc'), // PM-only, never returned to stakeholders
  callSummary: text('call_summary'),
  keyUpdates: text('key_updates').default('[]'), // JSON string[]
  attendeesClient: text('attendees_client').default('[]'), // JSON string[]
  attendeesInternal: text('attendees_internal').default('[]'), // JSON string[]
  brainSnapshot: text('brain_snapshot'), // JSON snapshot of assembled brain at processing time
  status: text('status').default('pending'), // pending | processing | done | error
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role').default('stakeholder'), // admin | pm | ad | stakeholder
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

/**
 * Append-only audit/operations log. Every interesting thing that happens in
 * the call-coaching pipeline writes one row here so the admin dashboard can
 * show end-to-end timelines (Zoom webhook → Cloudflare → Apps Script →
 * coaching doc → Slack DMs → SpiralFolio brain update).
 *
 * Rows are written from three sources:
 *   - `spiralfolio` : the Next.js app itself (call ingestion, brain mutations)
 *   - `appscript`   : the Google Apps Script pipeline (doPost, doc creation,
 *                     Slack DM dispatch). Posted to `/api/events/log`.
 *   - `cloudflare`  : the Zoom webhook proxy worker (optional — the Apps
 *                     Script also logs `cloudflare_webhook_received` as a
 *                     fallback signal whenever it receives a forwarded event).
 */
export const eventLogs = sqliteTable('event_logs', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  source: text('source').notNull().default('spiralfolio'), // spiralfolio | appscript | cloudflare | manual
  severity: text('severity').notNull().default('info'), // info | success | warning | error
  message: text('message'),

  clientId: text('client_id'),
  clientName: text('client_name'),

  meetingId: text('meeting_id'),
  meetingTopic: text('meeting_topic'),
  callId: text('call_id'),
  callDate: text('call_date'),

  docUrl: text('doc_url'),

  slackRecipient: text('slack_recipient'),
  slackRecipientEmail: text('slack_recipient_email'),
  slackMessage: text('slack_message'),
  slackChannelId: text('slack_channel_id'),
  slackTs: text('slack_ts'),

  payload: text('payload'), // arbitrary JSON for anything not captured above
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Concern = typeof concerns.$inferSelect;
export type Deliverable = typeof deliverables.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type Win = typeof wins.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
export type User = typeof users.$inferSelect;
export type EventLog = typeof eventLogs.$inferSelect;
export type NewEventLog = typeof eventLogs.$inferInsert;

export type ClientStatus = 'on-track' | 'at-risk' | 'blocked' | 'complete';
export type CallType = 'kickoff' | 'weekly' | 'ad-hoc' | 'review';
export type CallStatus = 'pending' | 'processing' | 'done' | 'error';
export type ConcernStatus = 'open' | 'in-progress' | 'resolved';
export type DeliverableStatus = 'in-progress' | 'pending' | 'blocked' | 'done';
export type DeliverableSide = 'us' | 'client';
export type ContactSide = 'client' | 'internal';
export type UserRole = 'admin' | 'pm' | 'ad' | 'stakeholder';

export type EventSource = 'spiralfolio' | 'appscript' | 'cloudflare' | 'manual';
export type EventSeverity = 'info' | 'success' | 'warning' | 'error';

/**
 * Canonical event types written to `event_logs`. Free-form strings are
 * permitted at the column level (so the Apps Script can add new types
 * without a schema migration), but the dashboard knows about these.
 */
export const KNOWN_EVENT_TYPES = [
  'cloudflare_webhook_received',
  'zoom_webhook_received',
  'appscript_processing_started',
  'appscript_processing_completed',
  'appscript_processing_skipped',
  'appscript_processing_error',
  'coaching_doc_created',
  'slack_dm_sent',
  'slack_dm_skipped',
  'slack_dm_failed',
  'transcript_uploaded',
  'call_imported',
  'brain_changed',
  'call_processing_error',
  'admin_login_succeeded',
  'admin_login_failed',
] as const;
export type KnownEventType = (typeof KNOWN_EVENT_TYPES)[number];
