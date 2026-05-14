import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-auth';
import { listDistinctEventTypes, listEvents, summarizeEvents } from '@/lib/db/events';
import { listClients } from '@/lib/db/queries';
import { EventLogExplorer } from '@/components/admin/EventLogExplorer';
import type { EventSeverity, EventSource } from '@/lib/db/schema';
import { mergeEventTypeFilters, parseEventGroupsParam } from '@/lib/admin/event-filters';

export const dynamic = 'force-dynamic';

const VALID_SOURCES: EventSource[] = ['spiralfolio', 'appscript', 'cloudflare', 'manual', 'zoom'];
const VALID_SEVERITIES: EventSeverity[] = ['info', 'success', 'warning', 'error'];

function parseList<T extends string>(value: string | undefined, allowed?: readonly T[]): T[] {
  if (!value) return [];
  const parts = value.split(',').map(s => s.trim()).filter(Boolean) as T[];
  return allowed ? parts.filter(p => (allowed as readonly string[]).includes(p)) : parts;
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
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

  const sources = parseList<EventSource>(get('sources'), VALID_SOURCES);
  const severities = parseList<EventSeverity>(get('severities'), VALID_SEVERITIES);
  const clientId = get('client_id') || undefined;
  const search = get('q') || undefined;
  const since = parseDate(get('since'));
  const until = parseDate(get('until'));

  const filters = {
    eventTypes: mergedEventTypes.length ? mergedEventTypes : undefined,
    eventGroups: eventGroups.length ? eventGroups : undefined,
    eventTypesIndividual: eventTypesRaw.length ? eventTypesRaw : undefined,
    sources: sources.length ? sources : undefined,
    severities: severities.length ? severities : undefined,
    clientId,
    search,
    since,
    until,
    limit: 100,
  };

  const [{ rows, nextCursor, total }, knownEventTypes, summary, allClients] = await Promise.all([
    listEvents(filters),
    listDistinctEventTypes(),
    summarizeEvents({ since, until }),
    listClients(),
  ]);

  return (
    <EventLogExplorer
      initialRows={rows}
      initialNextCursor={nextCursor ? `${nextCursor.createdAtMs}_${nextCursor.id}` : null}
      total={total}
      summary={summary}
      knownEventTypes={knownEventTypes}
      clients={allClients.map(c => ({ id: c.id, name: c.name }))}
      username={session.username}
      initialFilters={{
        eventTypes: eventTypesRaw,
        eventGroups,
        sources,
        severities,
        clientId: clientId ?? '',
        search: search ?? '',
        since: since ? since.toISOString().slice(0, 10) : '',
        until: until ? until.toISOString().slice(0, 10) : '',
      }}
    />
  );
}
