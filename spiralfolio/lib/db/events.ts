import 'server-only';
import { and, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm';
import { db } from './index';
import { eventLogs, type EventLog, type EventSeverity, type EventSource } from './schema';
import { nanoid } from '@/lib/utils/nanoid';
import { safeStringify } from '@/lib/utils/json';

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
  sources?: EventSource[];
  severities?: EventSeverity[];
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

export async function listEvents(filters: ListEventsFilters = {}): Promise<ListEventsResult> {
  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const conds = [] as ReturnType<typeof eq>[];

  if (filters.eventTypes && filters.eventTypes.length) {
    conds.push(sql`${eventLogs.eventType} IN (${sql.join(filters.eventTypes.map(t => sql`${t}`), sql`, `)})` as never);
  }
  if (filters.sources && filters.sources.length) {
    conds.push(sql`${eventLogs.source} IN (${sql.join(filters.sources.map(s => sql`${s}`), sql`, `)})` as never);
  }
  if (filters.severities && filters.severities.length) {
    conds.push(sql`${eventLogs.severity} IN (${sql.join(filters.severities.map(s => sql`${s}`), sql`, `)})` as never);
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

  return {
    rows: trimmed,
    nextCursor,
    total: Number(totalRows[0]?.n ?? 0),
  };
}

export async function listDistinctEventTypes(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ eventType: eventLogs.eventType })
    .from(eventLogs)
    .orderBy(eventLogs.eventType);
  return rows.map(r => r.eventType);
}

export type EventCountSummary = {
  total: number;
  bySeverity: Record<EventSeverity, number>;
  bySource: Record<EventSource, number>;
};

export async function summarizeEvents(filters: ListEventsFilters = {}): Promise<EventCountSummary> {
  const conds = [] as ReturnType<typeof eq>[];
  if (filters.since) conds.push(gte(eventLogs.createdAt, filters.since));
  if (filters.until) conds.push(lte(eventLogs.createdAt, filters.until));

  const where = conds.length ? and(...conds) : undefined;

  const [bySev, bySrc, totalRow] = await Promise.all([
    db
      .select({
        severity: eventLogs.severity,
        n: sql<number>`count(*)`,
      })
      .from(eventLogs)
      .where(where)
      .groupBy(eventLogs.severity),
    db
      .select({
        source: eventLogs.source,
        n: sql<number>`count(*)`,
      })
      .from(eventLogs)
      .where(where)
      .groupBy(eventLogs.source),
    db.select({ n: sql<number>`count(*)` }).from(eventLogs).where(where),
  ]);

  const bySeverity = { info: 0, success: 0, warning: 0, error: 0 } as Record<EventSeverity, number>;
  for (const r of bySev) {
    const k = (r.severity ?? 'info') as EventSeverity;
    bySeverity[k] = Number(r.n);
  }

  const bySource = { spiralfolio: 0, appscript: 0, cloudflare: 0, manual: 0 } as Record<EventSource, number>;
  for (const r of bySrc) {
    const k = (r.source ?? 'spiralfolio') as EventSource;
    bySource[k] = Number(r.n);
  }

  return {
    total: Number(totalRow[0]?.n ?? 0),
    bySeverity,
    bySource,
  };
}
