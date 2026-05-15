import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { listEvents, summarizePipelineParents, type ListEventsFilters } from '@/lib/db/events';
import {
  mergeEventTypeFilters,
  parseAdminSinceDay,
  parseAdminStatusParam,
  parseAdminUntilDayInclusive,
  parseEventGroupsParam,
} from '@/lib/admin/event-filters';

export const dynamic = 'force-dynamic';

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

  const eventTypesRaw = parseList(params.get('event_types'));
  const eventGroups = parseEventGroupsParam(params.get('event_groups'));
  const mergedEventTypes = mergeEventTypeFilters(eventTypesRaw, eventGroups);

  const { severities, pipelineSkipped } = parseAdminStatusParam(params.get('severities'));

  const filters: ListEventsFilters = {
    eventTypes: mergedEventTypes.length ? mergedEventTypes : undefined,
    eventGroups: eventGroups.length ? eventGroups : undefined,
    eventTypesIndividual: eventTypesRaw.length ? eventTypesRaw : undefined,
    severities: severities.length ? severities : undefined,
    pipelineSkipped: pipelineSkipped || undefined,
    clientId: params.get('client_id') ?? undefined,
    search: params.get('q') ?? undefined,
    limit: params.get('limit') ? Number(params.get('limit')) : undefined,
  };

  const since = parseAdminSinceDay(params.get('since'));
  if (since) filters.since = since;
  const until = parseAdminUntilDayInclusive(params.get('until'));
  if (until) filters.until = until;

  const cursor = params.get('cursor');
  if (cursor) {
    const [tsStr, id] = cursor.split('_');
    const ts = Number(tsStr);
    if (!Number.isNaN(ts) && id) {
      filters.cursor = { createdAtMs: ts, id };
    }
  }

  const listPromise = listEvents(filters);
  const summaryPromise = filters.cursor
    ? Promise.resolve(null)
    : summarizePipelineParents(filters);

  const [{ rows, nextCursor, total }, summary] = await Promise.all([listPromise, summaryPromise]);

  return NextResponse.json({
    rows,
    nextCursor: nextCursor ? `${nextCursor.createdAtMs}_${nextCursor.id}` : null,
    total,
    ...(summary ? { summary } : {}),
  });
}
