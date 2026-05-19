import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AdminEventLogShell } from '@/components/admin/AdminEventLogShell';
import { EventLogExplorer } from '@/components/admin/EventLogExplorer';
import {
  ADMIN_EVENT_LOG_PAGE_SIZE,
  mergeEventTypeFilters,
  parseAdminSinceDay,
  parseAdminStatusParam,
  parseAdminUntilDayInclusive,
  parseEventGroupsParam,
} from '@/lib/admin/event-filters';
import type { EventLog } from '@/lib/types/schema';
import type { EventCountSummary } from '@/lib/types/events';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/contexts/SessionContext';

function parseList<T extends string>(value: string | undefined, allowed?: readonly T[]): T[] {
  if (!value) return [];
  const parts = value.split(',').map(s => s.trim()).filter(Boolean) as T[];
  return allowed ? parts.filter(p => (allowed as readonly string[]).includes(p)) : parts;
}

const emptySummary = (): EventCountSummary => ({
  total: 0,
  byStatus: { Success: 0, Error: 0, Skipped: 0 },
});

export function AdminPage() {
  const { ready, user } = useSession();
  const [searchParams] = useSearchParams();

  const get = (k: string): string | undefined => searchParams.get(k) ?? undefined;

  const initialFilters = useMemo(() => {
    const eventTypesRaw = parseList(get('event_types'));
    const eventGroups = parseEventGroupsParam(get('event_groups'));
    const { severities, pipelineSkipped } = parseAdminStatusParam(get('severities'));
    const clientId = get('client_id') || undefined;
    const search = get('q') || undefined;
    const since = parseAdminSinceDay(get('since'));
    const until = parseAdminUntilDayInclusive(get('until'));

    return {
      eventTypesRaw,
      eventGroups,
      severities,
      pipelineSkipped,
      clientId,
      search,
      since,
      until,
      explorerFilters: {
        eventTypes: eventTypesRaw,
        eventGroups,
        statusValues: [...severities, ...(pipelineSkipped ? (['skipped'] as const) : [])],
        clientId: clientId ?? '',
        search: search ?? '',
        since: since ? since.toISOString().slice(0, 10) : '',
        until: until ? until.toISOString().slice(0, 10) : '',
      },
    };
  }, [searchParams]);

  const [rows, setRows] = useState<EventLog[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [summary, setSummary] = useState<EventCountSummary>(() => emptySummary());
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!ready || user?.role !== 'admin') return;
    let cancelled = false;

    const load = async () => {
      const mergedEventTypes = mergeEventTypeFilters(initialFilters.eventTypesRaw, initialFilters.eventGroups);
      const params = new URLSearchParams();
      if (mergedEventTypes.length) params.set('event_types', mergedEventTypes.join(','));
      if (initialFilters.eventGroups.length) params.set('event_groups', initialFilters.eventGroups.join(','));
      const statusParam = [
        ...initialFilters.severities,
        ...(initialFilters.pipelineSkipped ? ['skipped'] : []),
      ].join(',');
      if (statusParam) params.set('severities', statusParam);
      if (initialFilters.clientId) params.set('client_id', initialFilters.clientId);
      if (initialFilters.search) params.set('q', initialFilters.search);
      if (initialFilters.since) params.set('since', initialFilters.since.toISOString().slice(0, 10));
      if (initialFilters.until) params.set('until', initialFilters.until.toISOString().slice(0, 10));
      params.set('limit', String(ADMIN_EVENT_LOG_PAGE_SIZE));
      params.set('page', '1');

      const [clientsRes, eventsRes] = await Promise.all([
        apiFetch('/api/clients'),
        apiFetch(`/api/admin/events?${params.toString()}`),
      ]);
      if (cancelled || !eventsRes.ok) return;

      const listData = (await eventsRes.json()) as {
        rows: EventLog[];
        total: number;
        hasNextPage: boolean;
        summary?: EventCountSummary;
      };
      setRows(listData.rows);
      setTotalRows(listData.total);
      setHasNextPage(listData.hasNextPage);
      setSummary(listData.summary ?? emptySummary());

      if (clientsRes.ok) {
        const cj = (await clientsRes.json()) as { clients: { id: string; name: string }[] };
        setClients(cj.clients.map(c => ({ id: c.id, name: c.name })));
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [ready, user, initialFilters, searchParams]);

  if (!ready) {
    return null;
  }
  if (!user || user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AdminEventLogShell>
      <EventLogExplorer
        initialRows={rows}
        initialHasNextPage={hasNextPage}
        pageSize={ADMIN_EVENT_LOG_PAGE_SIZE}
        totalRows={totalRows}
        summary={summary}
        clients={clients}
        initialFilters={initialFilters.explorerFilters}
      />
    </AdminEventLogShell>
  );
}
