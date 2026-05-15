import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';
import { listEvents, summarizePipelineParents } from '@/lib/db/events';
import { listClients } from '@/lib/db/queries';
import { EventLogExplorer } from '@/components/admin/EventLogExplorer';
import {
  mergeEventTypeFilters,
  parseAdminSinceDay,
  parseAdminStatusParam,
  parseAdminUntilDayInclusive,
  parseEventGroupsParam,
} from '@/lib/admin/event-filters';

export const dynamic = 'force-dynamic';

function parseList<T extends string>(value: string | undefined, allowed?: readonly T[]): T[] {
  if (!value) return [];
  const parts = value.split(',').map(s => s.trim()).filter(Boolean) as T[];
  return allowed ? parts.filter(p => (allowed as readonly string[]).includes(p)) : parts;
}


export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = getAdminSession();
  if (!session) {
    redirect('/admin/login?from=/admin');
  }

  const get = (k: string): string | undefined => {
    const v = searchParams?.[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const eventTypesRaw = parseList(get('event_types'));
  const eventGroups = parseEventGroupsParam(get('event_groups'));
  const mergedEventTypes = mergeEventTypeFilters(eventTypesRaw, eventGroups);

  const { severities, pipelineSkipped } = parseAdminStatusParam(get('severities'));
  const clientId = get('client_id') || undefined;
  const search = get('q') || undefined;
  const since = parseAdminSinceDay(get('since'));
  const until = parseAdminUntilDayInclusive(get('until'));

  const filters = {
    eventTypes: mergedEventTypes.length ? mergedEventTypes : undefined,
    eventGroups: eventGroups.length ? eventGroups : undefined,
    eventTypesIndividual: eventTypesRaw.length ? eventTypesRaw : undefined,
    severities: severities.length ? severities : undefined,
    pipelineSkipped: pipelineSkipped || undefined,
    clientId,
    search,
    since,
    until,
    limit: 100,
  };

  const [{ rows, nextCursor }, summary, allClients] = await Promise.all([
    listEvents(filters),
    summarizePipelineParents(filters),
    listClients(),
  ]);

  return (
    <EventLogExplorer
      initialRows={rows}
      initialNextCursor={nextCursor ? `${nextCursor.createdAtMs}_${nextCursor.id}` : null}
      summary={summary}
      clients={allClients.map(c => ({ id: c.id, name: c.name }))}
      username={session.username}
      initialFilters={{
        eventTypes: eventTypesRaw,
        eventGroups,
        statusValues: [
          ...severities,
          ...(pipelineSkipped ? (['skipped'] as const) : []),
        ],
        clientId: clientId ?? '',
        search: search ?? '',
        since: since ? since.toISOString().slice(0, 10) : '',
        until: until ? until.toISOString().slice(0, 10) : '',
      }}
    />
  );
}
