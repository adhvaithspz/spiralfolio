import 'server-only';
import { and, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm';
import { db } from './index';
import { eventLogs, type EventLog, type EventSeverity, type EventSource } from './schema';
import { nanoid } from '@/lib/utils/nanoid';
import { safeStringify } from '@/lib/utils/json';
import type { EventGroupId } from '@/lib/admin/event-filters';
import {
  CALL_SKIPPED_UPSTREAM_EVENT_TYPES,
  EVENT_GROUP_META,
  SKIP_PIPELINE_STATUS_EVENT_TYPES,
} from '@/lib/admin/event-filters';
import {
  aggregatePipelineParents,
  meetingKey,
  type PipelineStatusWord,
} from '@/lib/admin/pipeline-event-groups';

/**
 * Append-only audit log helper. Every interesting moment in the call-coaching
 * pipeline (Zoom webhook → Cloudflare → Apps Script → coaching doc → Slack
 * DMs → SpiralFolio brain update) ends up here.
 *
 * `logEvent` never throws — operational logging must never break the request
 * that triggered it.
 */
export type LogEventInput = {
  eventType: string;
  source?: EventSource;
  severity?: EventSeverity;
  message?: string | null;

  clientId?: string | null;
  clientName?: string | null;

  meetingId?: string | null;
  meetingTopic?: string | null;
  callId?: string | null;
  callDate?: string | null;

  docUrl?: string | null;

  slackRecipient?: string | null;
  slackRecipientEmail?: string | null;
  slackMessage?: string | null;
  slackChannelId?: string | null;
  slackTs?: string | null;

  payload?: unknown;
  at?: Date;
};

export async function logEvent(input: LogEventInput): Promise<string | null> {
  const id = nanoid();
  const at = input.at ?? new Date();
  try {
    await db.insert(eventLogs).values({
      id,
      eventType: input.eventType,
      source: input.source ?? 'spiralfolio',
      severity: input.severity ?? 'info',
      message: input.message ?? null,
      clientId: input.clientId ?? null,
      clientName: input.clientName ?? null,
      meetingId: input.meetingId ?? null,
      meetingTopic: input.meetingTopic ?? null,
      callId: input.callId ?? null,
      callDate: input.callDate ?? null,
      docUrl: input.docUrl ?? null,
      slackRecipient: input.slackRecipient ?? null,
      slackRecipientEmail: input.slackRecipientEmail ?? null,
      slackMessage: input.slackMessage ?? null,
      slackChannelId: input.slackChannelId ?? null,
      slackTs: input.slackTs ?? null,
      payload: input.payload === undefined || input.payload === null ? null : safeStringify(input.payload),
      createdAt: at,
    });
    return id;
  } catch (err) {
    // Never let logging break the caller. Failed inserts get logged to the
    // server console so they're discoverable in Vercel logs.
    console.error('[events] logEvent failed:', err, { eventType: input.eventType });
    return null;
  }
}

export type ListEventsFilters = {
  eventTypes?: string[];
  /** Admin URL group chips — correlate expanded types (e.g. Zoom/CF with a skip) without listing every webhook. */
  eventGroups?: EventGroupId[];
  /** `event_types` param only; explicit type chips vs group expansion. */
  eventTypesIndividual?: string[];
  severities?: EventSeverity[];
  /** OR-combined with `severities` — Apps Script skip + intentional Slack DM skip rows. */
  pipelineSkipped?: boolean;
  clientId?: string;
  search?: string; // matches against meetingTopic, clientName, message, slackRecipient
  since?: Date;
  until?: Date;
  limit?: number;
  cursor?: { createdAtMs: number; id: string } | null;
};

export type ListEventsResult = {
  rows: EventLog[];
  nextCursor: { createdAtMs: number; id: string } | null;
  total: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

// Event types we never want to show in the admin dashboard. Keeping them as a
// list (rather than deleting old rows) preserves the underlying audit trail
// while hiding noise the operators don't care about.
const HIDDEN_EVENT_TYPE_PATTERNS = ['admin_login_%'];

function applyHiddenTypeFilter(conds: ReturnType<typeof eq>[]) {
  for (const pattern of HIDDEN_EVENT_TYPE_PATTERNS) {
    conds.push(sql`${eventLogs.eventType} NOT LIKE ${pattern}` as never);
  }
}

/** Pair Zoom/Cloudflare rows with a skip on the same call/meeting (±2h). Timestamps are ms (Drizzle sqlite `timestamp`). */
const CALL_SKIP_UPSTREAM_CORRELATION_MS = 2 * 60 * 60 * 1000;

/** Build `(event_type IN …)` or correlated webhook EXISTS when `call_skipped` is selected. */
function sqlForMergedEventTypes(
  mergedTypes: string[],
  eventGroups: EventGroupId[],
  individualTypes: Set<string>,
) {
  const upstreamList = CALL_SKIPPED_UPSTREAM_EVENT_TYPES as readonly string[];

  const callSkippedPipeline =
    eventGroups.includes('call_skipped') && mergedTypes.some(t => upstreamList.includes(t));

  if (!callSkippedPipeline) {
    return sql`${eventLogs.eventType} IN (${sql.join(mergedTypes.map(t => sql`${t}`), sql`, `)})`;
  }

  const upstreamGroupOnly = upstreamList.filter(t => mergedTypes.includes(t) && !individualTypes.has(t));
  const simpleTypes = mergedTypes.filter(t => !upstreamGroupOnly.includes(t));

  if (upstreamGroupOnly.length === 0) {
    return sql`${eventLogs.eventType} IN (${sql.join(mergedTypes.map(t => sql`${t}`), sql`, `)})`;
  }

  const upstreamIn = sql.join(upstreamGroupOnly.map(t => sql`${t}`), sql`, `);
  const correlatedUpstream = and(
    sql`${eventLogs.eventType} IN (${upstreamIn})`,
    sql`EXISTS (
      SELECT 1 FROM event_logs AS s
      WHERE s.event_type = 'appscript_processing_skipped'
      AND (
        (${eventLogs.callId} IS NOT NULL AND ${eventLogs.callId} = s.call_id AND s.call_id IS NOT NULL)
        OR (${eventLogs.meetingId} IS NOT NULL AND ${eventLogs.meetingId} = s.meeting_id AND s.meeting_id IS NOT NULL)
        OR (
          ${eventLogs.meetingTopic} IS NOT NULL AND s.meeting_topic IS NOT NULL
          AND lower(trim(${eventLogs.meetingTopic})) = lower(trim(s.meeting_topic))
        )
      )
      AND abs(cast(${eventLogs.createdAt} as integer) - cast(s.created_at as integer)) <= ${CALL_SKIP_UPSTREAM_CORRELATION_MS}
    )`,
  );

  if (simpleTypes.length > 0) {
    return or(
      sql`${eventLogs.eventType} IN (${sql.join(simpleTypes.map(t => sql`${t}`), sql`, `)})`,
      correlatedUpstream,
    );
  }
  return correlatedUpstream;
}

function pushMergedEventTypeCondition(
  conds: ReturnType<typeof eq>[],
  mergedTypes: string[],
  eventGroups: EventGroupId[] | undefined,
  individualTypes: string[] | undefined,
) {
  const groups = eventGroups ?? [];
  const indiv = new Set(individualTypes ?? []);
  const wantsBrainManual = groups.includes('brain_manual');
  const brainSet = new Set(EVENT_GROUP_META.brain_manual.types);

  let manualBrainTypes: string[] = [];
  let restTypes = mergedTypes;

  if (wantsBrainManual) {
    manualBrainTypes = mergedTypes.filter(t => brainSet.has(t));
    restTypes = mergedTypes.filter(t => !brainSet.has(t));
  }

  const clauses: ReturnType<typeof sql>[] = [];

  if (manualBrainTypes.length > 0) {
    clauses.push(
      and(
        sql`${eventLogs.eventType} IN (${sql.join(manualBrainTypes.map(t => sql`${t}`), sql`, `)})`,
        eq(eventLogs.source, 'manual'),
      ) as ReturnType<typeof sql>,
    );
  }

  if (restTypes.length > 0) {
    clauses.push(sqlForMergedEventTypes(restTypes, groups, indiv) as ReturnType<typeof sql>);
  }

  if (clauses.length === 0) return;
  if (clauses.length === 1) {
    conds.push(clauses[0] as never);
  } else {
    conds.push(or(...clauses) as never);
  }
}

/** True when operators narrowed the log — expand seeds to full meeting/call/topic clusters for grouping. */
export function shouldExpandClustersForFilters(filters: ListEventsFilters): boolean {
  return !!(
    (filters.eventTypes?.length ?? 0) > 0 ||
    (filters.eventGroups?.length ?? 0) > 0 ||
    (filters.severities?.length ?? 0) > 0 ||
    filters.pipelineSkipped ||
    (filters.clientId && filters.clientId.length > 0) ||
    (filters.search && filters.search.trim().length > 0) ||
    filters.since !== undefined ||
    filters.until !== undefined
  );
}

function collectClusterKeyParts(rows: EventLog[]): {
  meetingIds: string[];
  callIds: string[];
  topicsNorm: string[];
} {
  const meetingIds = new Set<string>();
  const callIds = new Set<string>();
  const topicsNorm = new Set<string>();
  for (const r of rows) {
    const k = meetingKey(r);
    if (!k) continue;
    if (k.startsWith('meeting:')) meetingIds.add(k.slice('meeting:'.length));
    else if (k.startsWith('call:')) callIds.add(k.slice('call:'.length));
    else if (k.startsWith('topic:')) topicsNorm.add(k.slice('topic:'.length));
  }
  return {
    meetingIds: [...meetingIds],
    callIds: [...callIds],
    topicsNorm: [...topicsNorm],
  };
}

function mergeDedupeSortEvents(seeds: EventLog[], peers: EventLog[]): EventLog[] {
  const map = new Map<string, EventLog>();
  for (const r of peers) map.set(r.id, r);
  for (const r of seeds) map.set(r.id, r);
  return [...map.values()].sort((a, b) => {
    const dt = b.createdAt.getTime() - a.createdAt.getTime();
    if (dt !== 0) return dt;
    return b.id.localeCompare(a.id);
  });
}

async function fetchClusterPeersForRows(
  seedRows: EventLog[],
  bounds: Pick<ListEventsFilters, 'since' | 'until' | 'clientId'>,
): Promise<EventLog[]> {
  const { meetingIds, callIds, topicsNorm } = collectClusterKeyParts(seedRows);
  if (!meetingIds.length && !callIds.length && !topicsNorm.length) return [];

  const conds = [] as ReturnType<typeof eq>[];
  applyHiddenTypeFilter(conds);
  if (bounds.since) conds.push(gte(eventLogs.createdAt, bounds.since));
  if (bounds.until) conds.push(lte(eventLogs.createdAt, bounds.until));
  if (bounds.clientId) conds.push(eq(eventLogs.clientId, bounds.clientId));

  const keyParts: ReturnType<typeof sql>[] = [];
  if (meetingIds.length) {
    keyParts.push(
      sql`${eventLogs.meetingId} IN (${sql.join(meetingIds.map(id => sql`${id}`), sql`, `)})`,
    );
  }
  if (callIds.length) {
    keyParts.push(sql`${eventLogs.callId} IN (${sql.join(callIds.map(id => sql`${id}`), sql`, `)})`);
  }
  for (const topic of topicsNorm) {
    keyParts.push(sql`lower(trim(${eventLogs.meetingTopic})) = ${topic}`);
  }

  conds.push(or(...keyParts) as never);

  return db.select().from(eventLogs).where(and(...conds));
}

function pushAdminEventLogFilters(conds: ReturnType<typeof eq>[], filters: ListEventsFilters): void {
  if (filters.eventTypes && filters.eventTypes.length) {
    pushMergedEventTypeCondition(
      conds,
      filters.eventTypes,
      filters.eventGroups,
      filters.eventTypesIndividual,
    );
  }
  const severityClause =
    filters.severities && filters.severities.length
      ? sql`${eventLogs.severity} IN (${sql.join(filters.severities.map(s => sql`${s}`), sql`, `)})`
      : null;
  const skipClause = filters.pipelineSkipped
    ? sql`${eventLogs.eventType} IN (${sql.join(
        SKIP_PIPELINE_STATUS_EVENT_TYPES.map(t => sql`${t}`),
        sql`, `,
      )})`
    : null;
  if (severityClause && skipClause) {
    conds.push(or(severityClause, skipClause) as never);
  } else if (severityClause) {
    conds.push(severityClause as never);
  } else if (skipClause) {
    conds.push(skipClause as never);
  }
  if (filters.clientId) {
    conds.push(eq(eventLogs.clientId, filters.clientId));
  }
  if (filters.since) {
    conds.push(gte(eventLogs.createdAt, filters.since));
  }
  if (filters.until) {
    conds.push(lte(eventLogs.createdAt, filters.until));
  }
  if (filters.search) {
    const needle = `%${filters.search.toLowerCase()}%`;
    conds.push(
      or(
        like(sql`lower(${eventLogs.meetingTopic})`, needle),
        like(sql`lower(${eventLogs.clientName})`, needle),
        like(sql`lower(${eventLogs.message})`, needle),
        like(sql`lower(${eventLogs.slackRecipient})`, needle),
        like(sql`lower(${eventLogs.slackRecipientEmail})`, needle),
        like(sql`lower(${eventLogs.eventType})`, needle),
      ) as never,
    );
  }
}

export async function listEvents(filters: ListEventsFilters = {}): Promise<ListEventsResult> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const conds = [] as ReturnType<typeof eq>[];
  applyHiddenTypeFilter(conds);
  pushAdminEventLogFilters(conds, filters);

  // Cursor-based pagination on (createdAt DESC, id DESC).
  if (filters.cursor) {
    const ts = new Date(filters.cursor.createdAtMs);
    conds.push(
      or(
        sql`${eventLogs.createdAt} < ${ts}`,
        and(eq(eventLogs.createdAt, ts), sql`${eventLogs.id} < ${filters.cursor.id}`),
      ) as never,
    );
  }

  const where = conds.length ? and(...conds) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(eventLogs)
      .where(where)
      .orderBy(desc(eventLogs.createdAt), desc(eventLogs.id))
      .limit(limit + 1),
    db.select({ n: sql<number>`count(*)` }).from(eventLogs).where(where),
  ]);

  let nextCursor: ListEventsResult['nextCursor'] = null;
  let trimmed = rows;
  if (rows.length > limit) {
    trimmed = rows.slice(0, limit);
    const last = trimmed[trimmed.length - 1];
    if (last) {
      nextCursor = {
        createdAtMs: last.createdAt.getTime(),
        id: last.id,
      };
    }
  }

  let rowsOut = trimmed;
  if (shouldExpandClustersForFilters(filters) && trimmed.length > 0) {
    const peers = await fetchClusterPeersForRows(trimmed, filters);
    rowsOut = mergeDedupeSortEvents(trimmed, peers);
  }

  return {
    rows: rowsOut,
    nextCursor,
    total: Number(totalRows[0]?.n ?? 0),
  };
}

export async function listDistinctEventTypes(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ eventType: eventLogs.eventType })
    .from(eventLogs)
    .where(sql`${eventLogs.eventType} NOT LIKE 'admin_login_%'`)
    .orderBy(eventLogs.eventType);
  return rows.map(r => r.eventType);
}

export type EventCountSummary = {
  /** Meetings / clustered runs (not raw log lines). */
  total: number;
  /** Per-meeting rollup — Success / Error / Skipped only. */
  byStatus: Record<PipelineStatusWord, number>;
};

/** Severity buckets + total parent rows for the admin strip — same filters as {@link listEvents}. */
export async function summarizePipelineParents(filters: ListEventsFilters = {}): Promise<EventCountSummary> {
  const conds = [] as ReturnType<typeof eq>[];
  applyHiddenTypeFilter(conds);
  pushAdminEventLogFilters(conds, filters);
  const where = conds.length ? and(...conds) : undefined;

  const seedRows = await db
    .select()
    .from(eventLogs)
    .where(where)
    .orderBy(desc(eventLogs.createdAt), desc(eventLogs.id));

  let rows = seedRows;
  if (shouldExpandClustersForFilters(filters) && seedRows.length > 0) {
    const peers = await fetchClusterPeersForRows(seedRows, filters);
    rows = mergeDedupeSortEvents(seedRows, peers);
  }

  const agg = aggregatePipelineParents(rows, filters.eventGroups ?? []);
  return {
    total: agg.totalParents,
    byStatus: agg.byStatus,
  };
}
