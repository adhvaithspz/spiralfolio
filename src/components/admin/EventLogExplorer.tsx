
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  Layers,
  Loader2,
  PhoneCall,
  RefreshCcw,
  Search,
  Slash,
  Sparkles,
  ShieldAlert,
  Waypoints,
  XCircle,
} from 'lucide-react';
import { relativeTime } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import { EmptyState } from '@/components/shared/EmptyState';
import { EventRowBody } from './EventRow';
import { AdminLogoutButton } from './AdminLogoutButton';
import type { EventLog, EventSeverity, EventSource } from '@/lib/types/schema';
import type { EventCountSummary } from '@/lib/types/events';
import {
  EVENT_GROUP_IDS,
  EVENT_GROUP_META,
  SKIP_PIPELINE_STATUS_TOKEN,
  eventTypePipelineStage,
  resolveEventDisplaySource,
  type EventGroupId,
  type PipelineStageId,
} from '@/lib/admin/event-filters';
import {
  brainIngestChannel,
  collapseStagedGroupsByMeetingKey,
  collapseStagesPerMeetingCluster,
  describeMergedMeetingSummary,
  groupRelatedEvents,
  isClientBrainPipelineEvent,
  mergeStageGroupsForGroupFilter,
  pipelineStatusWordForMergedCluster,
  pipelineStatusWordForStage,
  splitClusterIntoStages,
  toMs,
  typesInSelectedEventGroups,
  type PipelineStatusWord,
  type StagedPipelineGroup,
} from '@/lib/admin/pipeline-event-groups';
import { PipelineStatusBadge, PIPELINE_STATUS_RAIL } from '@/components/admin/PipelineStatusBadge';
import { apiFetch } from '@/lib/api';

type StatusFilterValue = EventSeverity | typeof SKIP_PIPELINE_STATUS_TOKEN;

type Filters = {
  eventTypes: string[];
  eventGroups: EventGroupId[];
  statusValues: StatusFilterValue[];
  clientId: string;
  search: string;
  since: string;
  until: string;
};

const STATUS_FILTER_OPTIONS: {
  value: StatusFilterValue;
  label: string;
  /** Query-token hint for operators sharing URLs */
  title?: string;
}[] = [
  { value: 'success', label: 'Success' },
  { value: 'error', label: 'Error' },
  { value: SKIP_PIPELINE_STATUS_TOKEN, label: 'Skipped', title: 'severities=skipped' },
];

function statusValuesToUrlParam(values: StatusFilterValue[]): string {
  const severities = values.filter((v): v is EventSeverity => v !== SKIP_PIPELINE_STATUS_TOKEN);
  const skipped = values.includes(SKIP_PIPELINE_STATUS_TOKEN);
  const parts: string[] = [...severities];
  if (skipped) parts.push(SKIP_PIPELINE_STATUS_TOKEN);
  return parts.join(',');
}

/** Any narrowing filter — list uses pipeline stage shells only (expand for raw lines). */
function explorerFiltersActive(f: Filters): boolean {
  return (
    f.eventTypes.length > 0 ||
    f.eventGroups.length > 0 ||
    f.statusValues.length > 0 ||
    Boolean(f.clientId.trim()) ||
    Boolean(f.search.trim()) ||
    Boolean(f.since) ||
    Boolean(f.until)
  );
}

export function EventLogExplorer({
  initialRows,
  initialHasNextPage,
  pageSize,
  totalRows: totalRowsProp,
  summary: summaryProp,
  clients,
  initialFilters,
}: {
  initialRows: EventLog[];
  initialHasNextPage: boolean;
  pageSize: number;
  totalRows: number;
  summary: EventCountSummary;
  clients: { id: string; name: string }[];
  initialFilters: Filters;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [summary, setSummary] = React.useState<EventCountSummary>(summaryProp);

  const [rows, setRows] = React.useState<EventLog[]>(initialRows);
  const [listMeta, setListMeta] = React.useState({
    totalRows: totalRowsProp,
  });
  const [hasMore, setHasMore] = React.useState(initialHasNextPage);
  const [pending, setPending] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [autorefresh, setAutorefresh] = React.useState(false);
  const [grouping, setGrouping] = React.useState(true);
  const [draft, setDraft] = React.useState<Filters>(initialFilters);

  const scrollRootRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const nextPageRef = React.useRef(2);
  const loadingMoreRef = React.useRef(false);
  const hasMoreRef = React.useRef(initialHasNextPage);

  React.useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  /** Strip legacy `page=` — list is infinite scroll client-side. */
  React.useEffect(() => {
    if (!searchParams.has('page')) return;
    const p = new URLSearchParams(searchParams.toString());
    p.delete('page');
    navigate(`/admin?${p.toString()}`, { replace: true });
  }, [navigate, searchParams]);

  const groups = React.useMemo(() => {
    let staged: StagedEventGroup[] = grouping
      ? groupRelatedEvents(rows).flatMap(c => collapseStagesPerMeetingCluster(splitClusterIntoStages(c)))
      : rows.map(r => ({
          primary: r,
          others: [] as EventLog[],
          stageId: eventTypePipelineStage(r.eventType),
        }));
    if (initialFilters.eventGroups.length) {
      staged = mergeStageGroupsForGroupFilter(staged, initialFilters.eventGroups);
    }
    staged = collapseStagedGroupsByMeetingKey(staged);
    staged.sort((a, b) => toMs(b.primary.createdAt) - toMs(a.primary.createdAt));
    return staged;
  }, [rows, grouping, initialFilters.eventGroups]);

  /** When a pipeline-group chip is applied, those matches should list as group shells only; expand for raw events. */
  const useGroupFilterShell = initialFilters.eventGroups.length > 0;

  React.useEffect(() => {
    setSummary(summaryProp);
  }, [summaryProp]);

  React.useEffect(() => {
    setRows(initialRows);
    setListMeta({ totalRows: totalRowsProp });
    setHasMore(initialHasNextPage);
    nextPageRef.current = 2;
    hasMoreRef.current = initialHasNextPage;
  }, [initialRows, totalRowsProp, initialHasNextPage]);

  React.useEffect(() => {
    setDraft(initialFilters);
  }, [initialFilters]);

  const applyFilters = React.useCallback(
    (next: Filters) => {
      const params = new URLSearchParams(searchParams.toString());
      const setOrDel = (key: string, val: string) => {
        if (val) params.set(key, val);
        else params.delete(key);
      };
      setOrDel('event_types', next.eventTypes.join(','));
      setOrDel('event_groups', next.eventGroups.join(','));
      setOrDel('severities', statusValuesToUrlParam(next.statusValues));
      setOrDel('client_id', next.clientId);
      setOrDel('q', next.search);
      setOrDel('since', next.since);
      setOrDel('until', next.until);
      params.delete('page');
      navigate(`/admin?${params.toString()}`, { replace: true });
    },
    [navigate, searchParams]
  );

  const loadMore = React.useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const pageToFetch = nextPageRef.current;
      const params = new URLSearchParams(searchParams.toString());
      params.delete('page');
      params.set('limit', String(pageSize));
      params.set('page', String(pageToFetch));
      const res = await apiFetch(`/api/admin/events?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as {
          rows: EventLog[];
          total: number;
          hasNextPage: boolean;
        };
        nextPageRef.current = pageToFetch + 1;
        setHasMore(data.hasNextPage);
        hasMoreRef.current = data.hasNextPage;
        setRows(prev => mergeDedupeSortEvents(prev, hydrateRows(data.rows)));
        setListMeta({ totalRows: data.total });
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [searchParams, pageSize]);

  const refresh = React.useCallback(async () => {
    setPending(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('page');
      params.set('limit', String(pageSize));
      params.set('page', '1');
      const res = await apiFetch(`/api/admin/events?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as {
          rows: EventLog[];
          summary?: EventCountSummary;
          total: number;
          hasNextPage: boolean;
        };
        setRows(hydrateRows(data.rows));
        setListMeta({ totalRows: data.total });
        setHasMore(data.hasNextPage);
        hasMoreRef.current = data.hasNextPage;
        nextPageRef.current = 2;
        if (data.summary) setSummary(data.summary);
      }
    } finally {
      setPending(false);
    }
  }, [searchParams, pageSize]);

  React.useEffect(() => {
    const root = scrollRootRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      entries => {
        const hit = entries.some(e => e.isIntersecting);
        if (hit) void loadMore();
      },
      { root, rootMargin: '140px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, rows.length]);

  React.useEffect(() => {
    if (!autorefresh) return;
    const t = setInterval(() => {
      void refresh();
    }, 15_000);
    return () => clearInterval(t);
  }, [autorefresh, refresh]);

  const filtersDirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialFilters),
    [draft, initialFilters]
  );

  /** With filters, API merges peer lines per meeting — always show stage shells, never a lone flat row. */
  const forceGroupedShells = explorerFiltersActive(initialFilters);

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden sm:gap-4 2xl:gap-5 min-[1920px]:gap-6">
      <header className="shrink-0 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2 2xl:gap-3 min-[1920px]:gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-text-muted sm:gap-2 sm:text-[11.5px] min-[1920px]:text-[12px]">
            <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Pipeline event log
          </div>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-text sm:mt-1 sm:text-xl md:text-2xl 2xl:text-[1.75rem] min-[1920px]:text-[2rem]">
            {summary.total.toLocaleString()} meeting{summary.total === 1 ? '' : 's'}
          </h1>
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5 overflow-x-auto scrollbar-subtle sm:gap-2 2xl:gap-2.5">
          <label className="flex shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface/50 px-2 py-1 text-[11px] text-text-dim sm:gap-2 sm:px-2.5 sm:py-1.5 sm:text-[12px] min-[1920px]:px-3 min-[1920px]:py-2">
            <input
              type="checkbox"
              checked={grouping}
              onChange={e => setGrouping(e.target.checked)}
              className="h-3 w-3 accent-accent"
            />
            <Layers className="h-3 w-3" />
            Group related
          </label>
          <label className="flex shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface/50 px-2 py-1 text-[11px] text-text-dim sm:gap-2 sm:px-2.5 sm:py-1.5 sm:text-[12px] min-[1920px]:px-3 min-[1920px]:py-2">
            <input
              type="checkbox"
              checked={autorefresh}
              onChange={e => setAutorefresh(e.target.checked)}
              className="h-3 w-3 accent-accent"
            />
            Auto-refresh (15s)
          </label>
          <Button variant="secondary" size="sm" onClick={refresh} disabled={pending || loadingMore}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <AdminLogoutButton />
        </div>
      </header>

      <div className="shrink-0">
        <SummaryStrip summary={summary} />
      </div>

      <div className="shrink-0">
        <FilterPanel
          draft={draft}
          setDraft={setDraft}
          clients={clients}
          onApply={() => applyFilters(draft)}
          onReset={() =>
            applyFilters({
              eventTypes: [],
              eventGroups: [],
              statusValues: [],
              clientId: '',
              search: '',
              since: '',
              until: '',
            })
          }
          dirty={filtersDirty}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-xl border border-border surface-glass">
        <div className="grid shrink-0 grid-cols-[150px_minmax(0,2fr)_minmax(0,1fr)_120px_120px] items-center gap-3 border-b border-border px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          <div>Time</div>
          <div>Event</div>
          <div>Client / Meeting</div>
          <div>Source</div>
          <div className="text-right">Status</div>
        </div>
        <div ref={scrollRootRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain bg-bg/20">
          {rows.length === 0 ? (
            <div className="p-10">
              <EmptyState
                title="No events match those filters."
                description="Trigger a Zoom webhook or upload a transcript to see entries appear here."
              />
            </div>
          ) : (
            <ol className="flex flex-col gap-2 p-2">
              {groups.map(group => {
                const shellForGroupFilter =
                  useGroupFilterShell && clusterOnlyContainsTypesFromSelectedGroups(group, initialFilters.eventGroups);
                const showGroupedRow = forceGroupedShells || shellForGroupFilter || group.others.length > 0;
                return showGroupedRow ? (
                  <GroupedEventRow key={`${group.stageId}-${group.primary.id}`} group={group} />
                ) : (
                  <li
                    key={`${group.stageId}-${group.primary.id}`}
                    className="overflow-hidden rounded-lg border border-border/70 bg-surface/40 transition hover:border-border-strong">
                    <EventRowBody row={group.primary} />
                  </li>
                );
              })}
              <div
                ref={sentinelRef}
                className="flex min-h-12 shrink-0 flex-col items-center justify-center gap-1 py-3 text-[11px] text-text-muted"
                aria-hidden>
                {loadingMore ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
                    <span>Loading older events…</span>
                  </>
                ) : hasMore ? (
                  <span className="text-text-muted/80">Scroll for older events</span>
                ) : rows.length > 0 ? (
                  <span className="text-text-muted/70">End of log</span>
                ) : null}
              </div>
            </ol>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-text-muted">
              {grouping ? (
                <>
                  <span className="text-text-muted/90"> · {summary.total.toLocaleString()} total matching filters</span>
                  <span className="text-text-muted/85">
                    {' '}
                    · <span className="stat-num">{rows.length.toLocaleString()}</span> log rows in memory
                  </span>
                </>
              ) : (
                <>
                  <span className="stat-num font-medium text-text">{rows.length.toLocaleString()}</span> row
                  {rows.length === 1 ? '' : 's'} loaded
                  <span className="text-text-muted/90">
                    {' '}
                    · {listMeta.totalRows.toLocaleString()} matching in database
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function hydrateRows(rows: EventLog[]): EventLog[] {
  // JSON serialisation turns Date columns into strings — coerce them back.
  return rows.map(r => ({
    ...r,
    createdAt: typeof r.createdAt === 'string' ? new Date(r.createdAt) : r.createdAt,
  }));
}

function mergeDedupeSortEvents(existing: EventLog[], incoming: EventLog[]): EventLog[] {
  const map = new Map<string, EventLog>();
  for (const r of existing) map.set(r.id, r);
  for (const r of incoming) map.set(r.id, r);
  return [...map.values()].sort((a, b) => {
    const dt = toMs(b.createdAt) - toMs(a.createdAt);
    if (dt !== 0) return dt;
    return b.id.localeCompare(a.id);
  });
}

function SummaryStrip({ summary }: { summary: EventCountSummary }) {
  const tiles = [
    { label: 'Errors', value: summary.byStatus.Error, icon: ShieldAlert, accent: 'text-status-red' },
    { label: 'Skipped', value: summary.byStatus.Skipped, icon: Slash, accent: 'text-text-muted' },
    { label: 'Success', value: summary.byStatus.Success, icon: CheckCircle2, accent: 'text-status-green' },
  ];
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2 2xl:gap-3 min-[1920px]:gap-3">
      {tiles.map(t => (
        <div
          key={t.label}
          className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-2.5 py-1.5 sm:rounded-xl sm:px-4 sm:py-2.5 2xl:px-5 2xl:py-3 min-[1920px]:py-3.5">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted sm:text-[10.5px]">
              {t.label}
            </div>
            <div className="stat-num mt-0 text-lg font-semibold text-text sm:mt-0.5 sm:text-2xl min-[1920px]:text-[1.75rem]">
              {t.value.toLocaleString()}
            </div>
          </div>
          <t.icon className={`h-4 w-4 shrink-0 sm:h-5 sm:w-5 ${t.accent}`} />
        </div>
      ))}
    </div>
  );
}

function FilterPanel({
  draft,
  setDraft,
  clients,
  onApply,
  onReset,
  dirty,
}: {
  draft: Filters;
  setDraft: React.Dispatch<React.SetStateAction<Filters>>;
  clients: { id: string; name: string }[];
  onApply: () => void;
  onReset: () => void;
  dirty: boolean;
}) {
  const toggleArray = <T extends string>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];

  return (
    <div className="rounded-lg border border-border bg-surface/40 p-2.5 sm:rounded-xl sm:p-4 2xl:p-5 min-[1920px]:p-6">
      <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-muted sm:gap-2 sm:text-[11.5px]">
        <Filter className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        Filters
      </div>

      <div className="mt-1.5 grid grid-cols-1 gap-2 sm:mt-2 sm:gap-2.5 lg:grid-cols-3 lg:gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted sm:text-[11px]">
            Search
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted sm:left-2.5 sm:h-3.5 sm:w-3.5" />
            <input
              type="text"
              value={draft.search}
              onChange={e => setDraft(d => ({ ...d, search: e.target.value }))}
              placeholder="meeting topic, client, message…"
              className="h-8 w-full rounded-md border border-border bg-bg pl-6 pr-2 text-[12px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent sm:h-9 sm:pl-7 sm:text-[12.5px]"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted sm:text-[11px]">
            Client
          </span>
          <select
            value={draft.clientId}
            onChange={e => setDraft(d => ({ ...d, clientId: e.target.value }))}
            className="h-8 rounded-md border border-border bg-bg px-2 text-[12px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent sm:h-9 sm:text-[12.5px]">
            <option value="">All clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted sm:text-[11px]">
              Since
            </span>
            <input
              type="date"
              value={draft.since}
              onChange={e => setDraft(d => ({ ...d, since: e.target.value }))}
              className="h-8 rounded-md border border-border bg-bg px-1.5 text-[12px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent sm:h-9 sm:px-2 sm:text-[12.5px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted sm:text-[11px]">
              Until
            </span>
            <input
              type="date"
              value={draft.until}
              onChange={e => setDraft(d => ({ ...d, until: e.target.value }))}
              className="h-8 rounded-md border border-border bg-bg px-1.5 text-[12px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent sm:h-9 sm:px-2 sm:text-[12.5px]"
            />
          </label>
        </div>
      </div>

      <div className="mt-1.5 grid min-w-0 grid-cols-1 gap-2 sm:mt-2 sm:gap-2.5 lg:grid-cols-2 lg:gap-3">
        <ChipGroup
          label="Status"
          layout="scroll"
          options={STATUS_FILTER_OPTIONS}
          selected={draft.statusValues}
          onToggle={v => setDraft(d => ({ ...d, statusValues: toggleArray(d.statusValues, v) }))}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted sm:text-[11px]">
            Event type
          </span>
          <div className="-mx-1 max-w-full overflow-x-auto px-1 pb-1 scrollbar-subtle">
            <div className="flex w-max flex-nowrap gap-1.5">
              {EVENT_GROUP_IDS.map(id => {
                const meta = EVENT_GROUP_META[id];
                const active = draft.eventGroups.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    title={`event_groups=${id}`}
                    onClick={() =>
                      setDraft(d => ({
                        ...d,
                        eventGroups: toggleArray(d.eventGroups, id),
                      }))
                    }
                    className={
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide transition ' +
                      (active
                        ? 'border-accent/60 bg-accent-soft text-accent'
                        : 'border-border bg-surface-2 text-text-dim hover:border-border-strong hover:text-text')
                    }>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-2 sm:mt-3">
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
        <Button variant="primary" size="sm" onClick={onApply} disabled={!dirty}>
          Apply filters
        </Button>
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  layout = 'wrap',
}: {
  label: string;
  options: { value: T; label: string; title?: string }[];
  selected: T[];
  onToggle: (v: T) => void;
  layout?: 'wrap' | 'scroll';
}) {
  const rowClass =
    layout === 'scroll'
      ? '-mx-1 flex max-w-full flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-subtle'
      : 'flex flex-wrap gap-1.5';

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label ? (
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">{label}</span>
      ) : null}
      <div className={rowClass}>
        {options.length === 0 && <span className="text-[12px] text-text-muted">— no values yet —</span>}
        {options.map(o => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              title={o.title}
              onClick={() => onToggle(o.value)}
              className={
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition ' +
                (active
                  ? 'border-accent/60 bg-accent-soft text-accent'
                  : 'border-border bg-surface-2 text-text-dim hover:border-border-strong hover:text-text')
              }>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Grouping logic is imported from `@/lib/admin/pipeline-event-groups` (shared with server-side summaries).

type StagedEventGroup = StagedPipelineGroup;

/** True when every event in the cluster is one of the types implied by the selected pipeline group chips. */
function clusterOnlyContainsTypesFromSelectedGroups(
  cluster: StagedEventGroup,
  selectedGroupIds: EventGroupId[]
): boolean {
  if (!selectedGroupIds.length) return false;
  const allowed = typesInSelectedEventGroups(selectedGroupIds);
  for (const e of [cluster.primary, ...cluster.others]) {
    if (!allowed.has(e.eventType)) return false;
  }
  return true;
}

const SOURCE_BADGE: Record<EventSource, string> = {
  cloudflare: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  appscript: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  slack: 'border-fuchsia-500/35 bg-fuchsia-500/12 text-fuchsia-300',
  spiralfolio: 'border-accent/30 bg-accent-soft text-accent',
  manual: 'border-border-strong bg-surface-2 text-text-dim',
  zoom: 'border-cyan-500/35 bg-cyan-500/12 text-cyan-300',
};

/**
 * Stage header copy — parent row title is always the pipeline stage; description
 * summarizes outcomes (Slack, brain, skip reason) so operators don't need to expand.
 */
type StageHeaderModel = {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconWrap: string;
  statusWord: PipelineStatusWord;
  statusBadge: React.ReactNode;
};

function describeStageSummary(stageId: PipelineStageId, events: EventLog[]): string {
  const types = new Set(events.map(e => e.eventType));

  switch (stageId) {
    case 'call_detected':
      return 'Zoom notified this meeting — expand for each webhook hop';
    case 'call_skipped': {
      const skip = events.find(e => e.eventType === 'appscript_processing_skipped');
      const base = skip?.message?.trim() || 'Apps Script did not queue processing';
      const hasWebhooks = events.some(
        e => e.eventType === 'zoom_webhook_received' || e.eventType === 'cloudflare_webhook_received'
      );
      const hasStarted = events.some(e => e.eventType === 'appscript_processing_started');
      let line = hasWebhooks ? `${base} · includes Zoom / Cloudflare webhook hops` : base;
      if (hasStarted) line += ' · Apps Script started before skip';
      return line;
    }
    case 'call_analysed': {
      const parts: string[] = [];
      if (types.has('coaching_doc_created')) parts.push('Coaching doc generated');
      if (types.has('slack_dm_sent')) parts.push('Slack DM sent');
      if (types.has('slack_dm_failed')) parts.push('Slack DM failed');
      if (types.has('slack_dm_skipped')) parts.push('Slack DM skipped');
      if (types.has('appscript_processing_completed')) parts.push('Apps Script finished');
      if (types.has('appscript_processing_error')) parts.push('Apps Script error');
      let line = parts.length ? parts.join(' · ') : 'Apps Script coaching steps — expand for detail';
      if (events.some(isClientBrainPipelineEvent)) {
        const ch = brainIngestChannel(events);
        if (ch === 'manual_upload') {
          line += ' · Brain ingest: manual SpiralFolio upload';
        } else if (ch === 'integration') {
          line += ' · Brain ingest: automated (Apps Script → SpiralFolio)';
        }
        if (types.has('call_processing_error')) {
          line += ' · SpiralFolio import failed';
        } else if (types.has('call_imported')) {
          const row = events.find(e => e.eventType === 'call_imported');
          if (row?.message?.trim()) line += ` · ${row.message.trim()}`;
        } else if (types.has('transcript_uploaded')) {
          const tu = events.find(e => e.eventType === 'transcript_uploaded');
          if (tu?.message?.trim()) line += ` · ${tu.message.trim()}`;
        }
      }
      return line;
    }
    case 'brain_manual': {
      if (types.has('call_processing_error')) {
        let s = 'SpiralFolio hit an error while importing';
        const ch = brainIngestChannel(events);
        if (ch === 'manual_upload') s += ' · Manual SpiralFolio upload';
        else if (ch === 'integration') s += ' · Apps Script → SpiralFolio';
        return s;
      }
      if (types.has('call_imported')) {
        const row = events.find(e => e.eventType === 'call_imported');
        let s = row?.message?.trim() || 'Call synthesized and brain updated';
        const ch = brainIngestChannel(events);
        if (ch === 'manual_upload') s += ' · Manual SpiralFolio upload';
        else if (ch === 'integration') s += ' · Apps Script → SpiralFolio';
        return s;
      }
      const tu = events.find(e => e.eventType === 'transcript_uploaded');
      if (tu) {
        let s = tu.message?.trim() || 'Transcript posted to SpiralFolio';
        const ch = brainIngestChannel(events);
        if (ch === 'manual_upload') s += ' · Manual SpiralFolio upload';
        else if (ch === 'integration') s += ' · Apps Script → SpiralFolio';
        return s;
      }
      return 'SpiralFolio-side activity — expand for detail';
    }
    case 'related':
    default:
      return 'Other events tied to this meeting';
  }
}

function buildStageHeader(stageId: PipelineStageId, events: EventLog[]): StageHeaderModel {
  const summary = stageId === 'related' ? describeMergedMeetingSummary(events) : describeStageSummary(stageId, events);
  const statusWord =
    stageId === 'related' ? pipelineStatusWordForMergedCluster(events) : pipelineStatusWordForStage(stageId, events);
  const statusBadge = <PipelineStatusBadge word={statusWord} />;

  if (stageId === 'related') {
    const hasKnownPipeline = events.some(e => eventTypePipelineStage(e.eventType) !== 'related');
    const hasAnalysed = events.some(e => eventTypePipelineStage(e.eventType) === 'call_analysed');
    const hasSkip = events.some(e => e.eventType === 'appscript_processing_skipped');

    // Multiple skip clusters collapsed into 'related' — show as skipped, not processed
    if (hasKnownPipeline && hasSkip && !hasAnalysed) {
      return {
        title: 'Call skipped',
        description: summary,
        icon: <Slash className="h-3.5 w-3.5" />,
        iconWrap: 'bg-surface-2 text-text-muted',
        statusWord,
        statusBadge,
      };
    }

    return {
      title: hasKnownPipeline ? 'Call Processed' : 'Related events',
      description: summary,
      icon: hasKnownPipeline ? (
        <Waypoints className="h-3.5 w-3.5" strokeWidth={2.25} />
      ) : (
        <Layers className="h-3.5 w-3.5" />
      ),
      iconWrap: hasKnownPipeline ? 'bg-emerald-500/15 text-emerald-300' : 'bg-surface-2 text-text-dim',
      statusWord,
      statusBadge,
    };
  }

  const meta = EVENT_GROUP_META[stageId];

  switch (stageId) {
    case 'call_skipped':
      return {
        title: meta.label,
        description: summary,
        icon: <Slash className="h-3.5 w-3.5" />,
        iconWrap: 'bg-surface-2 text-text-muted',
        statusWord,
        statusBadge,
      };
    case 'call_detected':
      return {
        title: meta.label,
        description: summary,
        icon: <PhoneCall className="h-3.5 w-3.5" />,
        iconWrap: 'bg-status-blue/15 text-status-blue',
        statusWord,
        statusBadge,
      };
    case 'call_analysed': {
      const mergedBrain = events.some(isClientBrainPipelineEvent);
      return {
        title: mergedBrain ? 'Call Processed and brain updated' : meta.label,
        description: summary,
        icon: mergedBrain ? (
          <span className="flex gap-0.5">
            <Sparkles className="h-3.5 w-3.5" />
            <Brain className="h-3.5 w-3.5 text-accent" />
          </span>
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        ),
        iconWrap: 'bg-emerald-500/15 text-emerald-300',
        statusWord,
        statusBadge,
      };
    }
    case 'brain_manual':
      return {
        title: meta.label,
        description: summary,
        icon: <Brain className="h-3.5 w-3.5" />,
        iconWrap: 'bg-accent-soft text-accent',
        statusWord,
        statusBadge,
      };
  }
}

function GroupedEventRow({ group }: { group: StagedEventGroup }) {
  const [expanded, setExpanded] = React.useState(false);
  const all = [group.primary, ...group.others];
  const total = all.length;

  const sources = Array.from(new Set(all.map(e => resolveEventDisplaySource(e)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
  const header = buildStageHeader(group.stageId, all);
  const statusWord = group.meetingRollupStatus ?? header.statusWord;
  const statusBadge = <PipelineStatusBadge word={statusWord} />;
  const railClass = PIPELINE_STATUS_RAIL[statusWord];

  const meetingTopic = all.find(e => e.meetingTopic)?.meetingTopic ?? all.find(e => e.callId)?.callId ?? null;
  const clientName = all.find(e => e.clientName)?.clientName ?? null;
  const callDate = all.find(e => e.callDate)?.callDate ?? null;

  const times = all.map(e => toMs(e.createdAt));
  const earliest = new Date(Math.min(...times));
  const latest = new Date(Math.max(...times));
  const spanMin = Math.max(0, Math.round((latest.getTime() - earliest.getTime()) / 60_000));

  return (
    <li
      className={`overflow-hidden rounded-lg border bg-surface/40 transition ${
        expanded
          ? 'border-accent/40 shadow-[0_0_0_1px_rgba(99,102,241,0.18)]'
          : 'border-border/70 hover:border-border-strong'
      }`}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="grid w-full grid-cols-[150px_minmax(0,2fr)_minmax(0,1fr)_120px_120px] items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60">
        <div>
          <div className="stat-num text-[12px] text-text">{relativeTime(latest)}</div>
          <div className="stat-num text-[10.5px] text-text-muted">
            {latest.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {spanMin > 0 && <span className="text-text-muted/70"> · {spanMin}m span</span>}
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-2.5">
          <div className={`mt-0.5 shrink-0 rounded-md p-1 ${header.iconWrap}`}>{header.icon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-text">{header.title}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                <Layers className="h-3 w-3" />
                {total} {total === 1 ? 'event' : 'events'}
              </span>
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              )}
            </div>
            <div className="mt-0.5 line-clamp-2 text-[12px] text-text-muted">
              {header.description}
              {sources.length > 0 && (
                <>
                  {' · '}
                  <span className="text-text-dim">{sources.join(', ')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          {clientName && <div className="truncate text-[12.5px] text-text">{clientName}</div>}
          {meetingTopic && <div className="truncate text-[11.5px] text-text-muted">{meetingTopic}</div>}
          {callDate && (
            <div className="text-[10.5px] text-text-muted">
              {new Date(callDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {sources.map(s => (
            <span
              key={s}
              className={
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ' +
                (SOURCE_BADGE[s] ?? SOURCE_BADGE.manual)
              }>
              {s}
            </span>
          ))}
        </div>

        <div className="text-right">{statusBadge}</div>
      </button>

      {expanded && (
        <div className="relative border-t border-border/70 bg-bg/30">
          {/* Vertical accent rail — overlay so it never shifts the row grid */}
          <span aria-hidden className={`pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] ${railClass}`} />
          {/* Children render edge-to-edge so their internal grid columns
              line up exactly with the parent header's grid columns. */}
          <ol className="flex flex-col divide-y divide-border/40">
            {all.map(row => (
              <li key={row.id} className="bg-bg/10">
                <EventRowBody row={row} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </li>
  );
}
