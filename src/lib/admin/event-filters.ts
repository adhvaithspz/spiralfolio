/**
 * Admin event log: pipeline "groups" are a separate filter dimension from raw
 * `event_type` values. URLs use `event_groups=call_detected,call_analysed,call_skipped,brain_manual`
 * (comma-separated). The server expands each slug into concrete `event_type` values for SQL.
 * **`brain_manual`** also restricts SpiralFolio rows to **`source = manual`** (PDF/upload path).
 *
 * UI grouping splits each meeting cluster into **stages** (`PipelineStageId`)
 * so parent rows line up with operator mental models (detect → analyse → brain).
 */

import type { EventSeverity, EventSource } from '@/lib/types/schema';

/** Rows per page for `/admin` and `GET /api/admin/events` (shared by SSR + client refresh). */
export const ADMIN_EVENT_LOG_PAGE_SIZE = 50;

const VALID_EVENT_SEVERITIES: EventSeverity[] = ['info', 'success', 'warning', 'error'];

/** URL `severities=` token — not a DB `severity`; matches explicit skip outcomes. */
export const SKIP_PIPELINE_STATUS_TOKEN = 'skipped' as const;

/** Event types treated as pipeline “skipped” in the admin Status filter. */
export const SKIP_PIPELINE_STATUS_EVENT_TYPES = [
  'appscript_processing_skipped',
  'slack_dm_skipped',
] as const;

/** Split `severities=` into DB severities plus optional skipped token (OR-combined in SQL). */
export function parseAdminStatusParam(raw: string | null | undefined): {
  severities: EventSeverity[];
  pipelineSkipped: boolean;
} {
  if (!raw) return { severities: [], pipelineSkipped: false };
  const parts = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const pipelineSkipped = parts.includes(SKIP_PIPELINE_STATUS_TOKEN);
  const severities = parts.filter((p): p is EventSeverity =>
    VALID_EVENT_SEVERITIES.includes(p as EventSeverity),
  );
  return { severities, pipelineSkipped };
}

/** URL `event_groups=` slugs (order matches filter chip order). */
export const EVENT_GROUP_IDS = [
  'call_detected',
  'call_analysed',
  'call_skipped',
  'brain_manual',
] as const;
export type EventGroupId = (typeof EVENT_GROUP_IDS)[number];

/** Stages shown as parent rows; `related` is not a filter chip. */
export type PipelineStageId = EventGroupId | 'related';

/** Webhook hops before Apps Script records `appscript_processing_skipped`. */
export const CALL_SKIPPED_UPSTREAM_EVENT_TYPES = [
  'cloudflare_webhook_received',
  'zoom_webhook_received',
] as const;

export const EVENT_GROUP_META: Record<EventGroupId, { label: string; types: string[] }> = {
  call_detected: {
    label: 'Call detected',
    types: ['zoom_webhook_received', 'cloudflare_webhook_received'],
  },
  call_analysed: {
    label: 'Call Processed',
    types: [
      'appscript_processing_started',
      'appscript_processing_completed',
      'appscript_processing_error',
      'coaching_doc_created',
      'slack_dm_sent',
      'slack_dm_skipped',
      'slack_dm_failed',
    ],
  },
  call_skipped: {
    label: 'Call skipped',
    types: ['appscript_processing_skipped', ...CALL_SKIPPED_UPSTREAM_EVENT_TYPES],
  },
  /** SpiralFolio brain rows from manual transcript upload (`source = manual`). See `listEvents` filter. */
  brain_manual: {
    label: 'Brain updated manually',
    types: ['transcript_uploaded', 'call_imported', 'brain_changed', 'call_processing_error'],
  },
};

export function isEventGroupId(v: string): v is EventGroupId {
  return (EVENT_GROUP_IDS as readonly string[]).includes(v);
}

/** Old URLs used `client_brain`; normalize before merging filters or parsing params. */
const LEGACY_EVENT_GROUP_ALIASES: Record<string, EventGroupId> = {
  client_brain: 'brain_manual',
};

/** Merge individual event types + expanded group types (deduped). */
export function mergeEventTypeFilters(individual: string[], groupIds: string[]): string[] {
  const out = new Set<string>(individual.filter(Boolean));
  for (const raw of groupIds) {
    const g = LEGACY_EVENT_GROUP_ALIASES[raw] ?? raw;
    if (!isEventGroupId(g)) continue;
    for (const t of EVENT_GROUP_META[g].types) out.add(t);
  }
  return [...out];
}

export function parseEventGroupsParam(raw: string | null | undefined): EventGroupId[] {
  if (!raw) return [];
  const parts = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(p => LEGACY_EVENT_GROUP_ALIASES[p] ?? p);
  return parts.filter((p): p is EventGroupId => isEventGroupId(p));
}

/**
 * Which pipeline stage a row belongs to for grouped display. Order here does
 * not interact with filter group expansion: webhooks are always "detected"
 * even though `call_skipped` filter SQL also mentions webhook types.
 */
export function eventTypePipelineStage(eventType: string): PipelineStageId {
  if (eventType === 'zoom_webhook_received' || eventType === 'cloudflare_webhook_received') {
    return 'call_detected';
  }
  if (eventType === 'appscript_processing_skipped') return 'call_skipped';
  if (
    eventType === 'appscript_processing_started' ||
    eventType === 'appscript_processing_completed' ||
    eventType === 'appscript_processing_error' ||
    eventType === 'coaching_doc_created' ||
    eventType.startsWith('slack_dm_')
  ) {
    return 'call_analysed';
  }
  if (
    eventType === 'transcript_uploaded' ||
    eventType === 'call_imported' ||
    eventType === 'brain_changed' ||
    eventType === 'call_processing_error'
  ) {
    return 'brain_manual';
  }
  return 'related';
}

/** Calendar day from `YYYY-MM-DD` — local start of day (inclusive). */
export function parseAdminSinceDay(raw: string | null | undefined): Date | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Calendar day from `YYYY-MM-DD` — local end of day (inclusive). */
export function parseAdminUntilDayInclusive(raw: string | null | undefined): Date | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Slack DM lines should show source Slack (legacy rows may still have `appscript` in the DB). */
export function resolveEventDisplaySource(row: {
  source: string | null | undefined;
  eventType: string;
}): EventSource {
  if (row.eventType.startsWith('slack_dm_')) return 'slack';
  return (row.source ?? 'spiralfolio') as EventSource;
}
