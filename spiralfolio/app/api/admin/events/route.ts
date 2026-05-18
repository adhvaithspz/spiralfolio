import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { listEvents, summarizePipelineParents, type ListEventsFilters } from '@/lib/db/events';
import {
  ADMIN_EVENT_LOG_PAGE_SIZE,
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

  const limitRaw = params.get('limit') ? Number(params.get('limit')) : ADMIN_EVENT_LOG_PAGE_SIZE;
  const limit = Math.min(
    500,
    Math.max(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : ADMIN_EVENT_LOG_PAGE_SIZE, 1),
  );
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * limit;

  const filters: ListEventsFilters = {
    eventTypes: mergedEventTypes.length ? mergedEventTypes : undefined,
    eventGroups: eventGroups.length ? eventGroups : undefined,
    eventTypesIndividual: eventTypesRaw.length ? eventTypesRaw : undefined,
    severities: severities.length ? severities : undefined,
    pipelineSkipped: pipelineSkipped || undefined,
    clientId: params.get('client_id') ?? undefined,
    search: params.get('q') ?? undefined,
    limit,
    offset,
  };

  const since = parseAdminSinceDay(params.get('since'));
  if (since) filters.since = since;
  const until = parseAdminUntilDayInclusive(params.get('until'));
  if (until) filters.until = until;

  const listPromise = listEvents(filters);
  const summaryPromise = page > 1 ? Promise.resolve(null) : summarizePipelineParents(filters);

  const [{ rows, total, hasNextPage }, summary] = await Promise.all([listPromise, summaryPromise]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return NextResponse.json({
    rows,
    page,
    limit,
    total,
    totalPages,
    hasNextPage,
    ...(summary ? { summary } : {}),
  });
}
