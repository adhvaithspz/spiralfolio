import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { listEvents, summarizeEvents, type ListEventsFilters } from '@/lib/db/events';
import type { EventSeverity, EventSource } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

const SOURCES: EventSource[] = ['spiralfolio', 'appscript', 'cloudflare', 'manual'];
const SEVERITIES: EventSeverity[] = ['info', 'success', 'warning', 'error'];

function parseList(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export async function GET(req: Request) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const params = url.searchParams;

  const eventTypes = parseList(params.get('event_types'));
  const sourcesRaw = parseList(params.get('sources')) as EventSource[];
  const severitiesRaw = parseList(params.get('severities')) as EventSeverity[];
  const sources = sourcesRaw.filter(s => SOURCES.includes(s));
  const severities = severitiesRaw.filter(s => SEVERITIES.includes(s));

  const filters: ListEventsFilters = {
    eventTypes: eventTypes.length ? eventTypes : undefined,
    sources: sources.length ? sources : undefined,
    severities: severities.length ? severities : undefined,
    clientId: params.get('client_id') ?? undefined,
    search: params.get('q') ?? undefined,
    limit: params.get('limit') ? Number(params.get('limit')) : undefined,
  };

  const since = params.get('since');
  if (since) {
    const t = new Date(since);
    if (!Number.isNaN(t.getTime())) filters.since = t;
  }
  const until = params.get('until');
  if (until) {
    const t = new Date(until);
    if (!Number.isNaN(t.getTime())) filters.until = t;
  }

  const cursor = params.get('cursor');
  if (cursor) {
    const [tsStr, id] = cursor.split('_');
    const ts = Number(tsStr);
    if (!Number.isNaN(ts) && id) {
      filters.cursor = { createdAtMs: ts, id };
    }
  }

  const [{ rows, nextCursor, total }, summary] = await Promise.all([
    listEvents(filters),
    summarizeEvents({ since: filters.since, until: filters.until }),
  ]);

  return NextResponse.json({
    rows,
    nextCursor: nextCursor ? `${nextCursor.createdAtMs}_${nextCursor.id}` : null,
    total,
    summary,
  });
}
