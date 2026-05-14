'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Filter,
  Layers,
  Loader2,
  PhoneCall,
  RefreshCcw,
  Search,
  Slash,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { relativeTime } from '@/lib/utils';
import { Button } from '@/components/shared/Button';
import { EmptyState } from '@/components/shared/EmptyState';
import { EventRowBody } from './EventRow';
import { AdminLogoutButton } from './AdminLogoutButton';
import type { EventLog, EventSeverity, EventSource } from '@/lib/db/schema';
import type { EventCountSummary } from '@/lib/db/events';
import { EVENT_GROUP_IDS, EVENT_GROUP_META, type EventGroupId } from '@/lib/admin/event-filters';

type Filters = {
  eventTypes: string[];
  eventGroups: EventGroupId[];
  sources: EventSource[];
  severities: EventSeverity[];
  clientId: string;
  search: string;
  since: string;
  until: string;
};

const ALL_SOURCES: { value: EventSource; label: string }[] = [
  { value: 'cloudflare', label: 'Cloudflare' },
  { value: 'appscript', label: 'Apps Script' },
  { value: 'spiralfolio', label: 'SpiralFolio' },
  { value: 'manual', label: 'Manual' },
  { value: 'zoom', label: 'Zoom' },
];

const ALL_SEVERITIES: { value: EventSeverity; label: string }[] = [
  { value: 'success', label: 'Success' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
];

export function EventLogExplorer({
  initialRows,
  initialNextCursor,
  total,
  summary,
  knownEventTypes,
  clients,
  username,
  initialFilters,
}: {
  initialRows: EventLog[];
  initialNextCursor: string | null;
  total: number;
  summary: EventCountSummary;
  knownEventTypes: string[];
  clients: { id: string; name: string }[];
  username: string;
  initialFilters: Filters;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = React.useState<EventLog[]>(initialRows);
  const [cursor, setCursor] = React.useState<string | null>(initialNextCursor);
  const [pending, setPending] = React.useState(false);
  const [autorefresh, setAutorefresh] = React.useState(false);
  const [grouping, setGrouping] = React.useState(true);
  const [draft, setDraft] = React.useState<Filters>(initialFilters);

  const groups = React.useMemo(() => {
    let base = grouping ? groupRelatedEvents(rows) : rows.map(r => ({ primary: r, others: [] as EventLog[] }));
    if (initialFilters.eventGroups.length) {
      base = mergeClustersSameMeetingForGroupFilter(base, initialFilters.eventGroups);
    }
    return base;
  }, [rows, grouping, initialFilters.eventGroups]);

  /** When a pipeline-group chip is applied, those matches should list as group shells only; expand for raw events. */
  const useGroupFilterShell = initialFilters.eventGroups.length > 0;

  React.useEffect(() => {
    setRows(initialRows);
    setCursor(initialNextCursor);
  }, [initialRows, initialNextCursor]);

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
      setOrDel('sources', next.sources.join(','));
      setOrDel('severities', next.severities.join(','));
      setOrDel('client_id', next.clientId);
      setOrDel('q', next.search);
      setOrDel('since', next.since);
      setOrDel('until', next.until);
      router.replace(`/admin?${params.toString()}`);
    },
    [router, searchParams],
  );

  const loadMore = React.useCallback(async () => {
    if (!cursor || pending) return;
    setPending(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set('cursor', cursor);
      const res = await fetch(`/api/admin/events?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as {
          rows: EventLog[];
          nextCursor: string | null;
        };
        setRows(prev => [...prev, ...hydrateRows(data.rows)]);
        setCursor(data.nextCursor);
      }
    } finally {
      setPending(false);
    }
  }, [cursor, pending, searchParams]);

  const refresh = React.useCallback(async () => {
    setPending(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('cursor');
      const res = await fetch(`/api/admin/events?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as {
          rows: EventLog[];
          nextCursor: string | null;
        };
        setRows(hydrateRows(data.rows));
        setCursor(data.nextCursor);
      }
    } finally {
      setPending(false);
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (!autorefresh) return;
    const t = setInterval(() => {
      void refresh();
    }, 15_000);
    return () => clearInterval(t);
  }, [autorefresh, refresh]);

  const filtersDirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialFilters),
    [draft, initialFilters],
  );

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] max-h-[calc(100dvh-6.5rem)] flex-col gap-5 overflow-hidden">
      <header className="shrink-0 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            <Activity className="h-3.5 w-3.5" />
            Pipeline event log
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-text">
            {total.toLocaleString()} event{total === 1 ? '' : 's'}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-text-muted">
            Zoom webhooks, Apps Script processing, Slack DMs, coaching docs, and SpiralFolio brain
            updates — newest first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-text-muted">
            Signed in as <span className="text-text">{username}</span>
          </span>
          <span aria-hidden className="h-4 w-px bg-border" />
          <label className="flex select-none items-center gap-2 rounded-md border border-border bg-surface/50 px-2.5 py-1.5 text-[12px] text-text-dim">
            <input
              type="checkbox"
              checked={grouping}
              onChange={e => setGrouping(e.target.checked)}
              className="h-3 w-3 accent-accent"
            />
            <Layers className="h-3 w-3" />
            Group related
          </label>
          <label className="flex select-none items-center gap-2 rounded-md border border-border bg-surface/50 px-2.5 py-1.5 text-[12px] text-text-dim">
            <input
              type="checkbox"
              checked={autorefresh}
              onChange={e => setAutorefresh(e.target.checked)}
              className="h-3 w-3 accent-accent"
            />
            Auto-refresh (15s)
          </label>
          <Button variant="secondary" size="sm" onClick={refresh} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
          <AdminLogoutButton />
        </div>
      </header>

      <SummaryStrip summary={summary} />

      <div className="shrink-0">
        <FilterPanel
        draft={draft}
        setDraft={setDraft}
        knownEventTypes={knownEventTypes}
        clients={clients}
        onApply={() => applyFilters(draft)}
        onReset={() =>
          applyFilters({
            eventTypes: [],
            eventGroups: [],
            sources: [],
            severities: [],
            clientId: '',
            search: '',
            since: '',
            until: '',
          })
        }
        dirty={filtersDirty}
      />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border surface-glass">
        <div className="grid shrink-0 grid-cols-[150px_minmax(0,2fr)_minmax(0,1fr)_120px_120px] items-center gap-3 border-b border-border px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          <div>Time</div>
          <div>Event</div>
          <div>Client / Meeting</div>
          <div>Source</div>
          <div className="text-right">Status</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
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
                  useGroupFilterShell &&
                  clusterOnlyContainsTypesFromSelectedGroups(group, initialFilters.eventGroups);
                const showGroupedRow = shellForGroupFilter || group.others.length > 0;
                return showGroupedRow ? (
                  <GroupedEventRow key={group.primary.id} group={group} />
                ) : (
                  <li
                    key={group.primary.id}
                    className="overflow-hidden rounded-lg border border-border/70 bg-surface/40 transition hover:border-border-strong">
                    <EventRowBody row={group.primary} />
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        {cursor && (
          <div className="flex shrink-0 items-center justify-center border-t border-border p-3">
            <Button variant="secondary" size="sm" onClick={loadMore} disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Load more
            </Button>
          </div>
        )}
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

function SummaryStrip({ summary }: { summary: EventCountSummary }) {
  const tiles = [
    { label: 'Errors', value: summary.bySeverity.error, icon: ShieldAlert, accent: 'text-status-red' },
    { label: 'Warnings', value: summary.bySeverity.warning, icon: AlertTriangle, accent: 'text-status-yellow' },
    { label: 'Successes', value: summary.bySeverity.success, icon: CheckCircle2, accent: 'text-status-green' },
    { label: 'Info', value: summary.bySeverity.info, icon: CircleDot, accent: 'text-status-blue' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(t => (
        <div
          key={t.label}
          className="flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-3">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {t.label}
            </div>
            <div className="stat-num mt-1 text-2xl font-semibold text-text">
              {t.value.toLocaleString()}
            </div>
          </div>
          <t.icon className={`h-5 w-5 ${t.accent}`} />
        </div>
      ))}
    </div>
  );
}

function FilterPanel({
  draft,
  setDraft,
  knownEventTypes,
  clients,
  onApply,
  onReset,
  dirty,
}: {
  draft: Filters;
  setDraft: React.Dispatch<React.SetStateAction<Filters>>;
  knownEventTypes: string[];
  clients: { id: string; name: string }[];
  onApply: () => void;
  onReset: () => void;
  dirty: boolean;
}) {
  const toggleArray = <T extends string>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];

  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        <Filter className="h-3.5 w-3.5" />
        Filters
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            Search
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={draft.search}
              onChange={e => setDraft(d => ({ ...d, search: e.target.value }))}
              placeholder="meeting topic, client, message…"
              className="h-9 w-full rounded-md border border-border bg-bg pl-7 pr-2 text-[12.5px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
            Client
          </span>
          <select
            value={draft.clientId}
            onChange={e => setDraft(d => ({ ...d, clientId: e.target.value }))}
            className="h-9 rounded-md border border-border bg-bg px-2 text-[12.5px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent">
            <option value="">All clients</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Since
            </span>
            <input
              type="date"
              value={draft.since}
              onChange={e => setDraft(d => ({ ...d, since: e.target.value }))}
              className="h-9 rounded-md border border-border bg-bg px-2 text-[12.5px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Until
            </span>
            <input
              type="date"
              value={draft.until}
              onChange={e => setDraft(d => ({ ...d, until: e.target.value }))}
              className="h-9 rounded-md border border-border bg-bg px-2 text-[12.5px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
        <ChipGroup
          label="Source"
          layout="scroll"
          options={ALL_SOURCES}
          selected={draft.sources}
          onToggle={v => setDraft(d => ({ ...d, sources: toggleArray(d.sources, v) }))}
        />
        <ChipGroup
          label="Status"
          layout="scroll"
          options={ALL_SEVERITIES}
          selected={draft.severities}
          onToggle={v => setDraft(d => ({ ...d, severities: toggleArray(d.severities, v) }))}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
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
              {knownEventTypes.map(t => {
                const active = draft.eventTypes.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setDraft(d => ({
                        ...d,
                        eventTypes: toggleArray(d.eventTypes, t),
                      }))
                    }
                    className={
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition ' +
                      (active
                        ? 'border-accent/60 bg-accent-soft text-accent'
                        : 'border-border bg-surface-2 text-text-dim hover:border-border-strong hover:text-text')
                    }>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
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
  options: { value: T; label: string }[];
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
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
          {label}
        </span>
      ) : null}
      <div className={rowClass}>
        {options.length === 0 && (
          <span className="text-[12px] text-text-muted">— no values yet —</span>
        )}
        {options.map(o => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
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

// ── Grouping ────────────────────────────────────────────────────────────────
//
// Many pipeline events arrive in clusters — e.g. a Zoom webhook is forwarded
// by Cloudflare and then immediately mirrored by Apps Script, producing two
// separate rows for the same logical event. Or a single call import used to
// produce three rows (transcript_uploaded → call_imported → brain_changed).
// We collapse rows that share the same meeting / call key AND occurred within
// a short time window into a single visual "group", keeping all the underlying
// rows accessible behind an expand toggle so nothing is hidden permanently.

type EventGroup = {
  primary: EventLog;
  others: EventLog[]; // older events in the same group, ordered as in the source list
};

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function meetingKey(row: EventLog): string | null {
  if (row.callId) return `call:${row.callId}`;
  if (row.meetingId) return `meeting:${row.meetingId}`;
  if (row.meetingTopic) {
    const norm = row.meetingTopic.trim().toLowerCase().replace(/\s+/g, ' ');
    if (norm.length >= 3) return `topic:${norm}`;
  }
  return null;
}

function toMs(d: Date | string): number {
  return (typeof d === 'string' ? new Date(d) : d).getTime();
}

function groupRelatedEvents(rows: EventLog[]): EventGroup[] {
  const groups: EventGroup[] = [];

  for (const row of rows) {
    const key = meetingKey(row);
    if (!key) {
      groups.push({ primary: row, others: [] });
      continue;
    }

    const ts = toMs(row.createdAt);
    const match = groups.find(g => {
      if (meetingKey(g.primary) !== key) return false;
      const all = [g.primary, ...g.others];
      return all.some(e => Math.abs(toMs(e.createdAt) - ts) <= GROUP_WINDOW_MS);
    });

    if (match) {
      // rows arrive newest-first, so any row reaching here is older than primary
      match.others.push(row);
    } else {
      groups.push({ primary: row, others: [] });
    }
  }

  return groups;
}

function typesInSelectedEventGroups(groupIds: EventGroupId[]): Set<string> {
  const s = new Set<string>();
  for (const id of groupIds) {
    for (const t of EVENT_GROUP_META[id].types) s.add(t);
  }
  return s;
}

/** True when every event in the cluster is one of the types implied by the selected pipeline group chips. */
function clusterOnlyContainsTypesFromSelectedGroups(
  cluster: EventGroup,
  selectedGroupIds: EventGroupId[],
): boolean {
  if (!selectedGroupIds.length) return false;
  const allowed = typesInSelectedEventGroups(selectedGroupIds);
  for (const e of [cluster.primary, ...cluster.others]) {
    if (!allowed.has(e.eventType)) return false;
  }
  return true;
}

/**
 * `groupRelatedEvents` only links rows within a short time window, so the same
 * call can produce multiple islands (e.g. several skips minutes apart). When a
 * pipeline group chip is active, merge every cluster that shares the same meeting
 * key and only contains those groups' event types — expand then lists all rows.
 */
function mergeClustersSameMeetingForGroupFilter(
  groups: EventGroup[],
  selectedGroupIds: EventGroupId[],
): EventGroup[] {
  if (!selectedGroupIds.length) return groups;

  const allowed = typesInSelectedEventGroups(selectedGroupIds);
  const mergeableByKey = new Map<string, Map<string, EventLog>>();
  const unmerged: EventGroup[] = [];

  for (const g of groups) {
    const all = [g.primary, ...g.others];
    const key = meetingKey(g.primary);
    const allAllowed = all.every(e => allowed.has(e.eventType));
    if (key && allAllowed) {
      let bucket = mergeableByKey.get(key);
      if (!bucket) {
        bucket = new Map();
        mergeableByKey.set(key, bucket);
      }
      for (const e of all) {
        bucket.set(e.id, e);
      }
    } else {
      unmerged.push(g);
    }
  }

  const merged: EventGroup[] = [];
  for (const byId of mergeableByKey.values()) {
    const events = [...byId.values()].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    const [primary, ...others] = events;
    if (primary) merged.push({ primary, others });
  }

  return [...merged, ...unmerged].sort((a, b) => toMs(b.primary.createdAt) - toMs(a.primary.createdAt));
}

const SEVERITY_RANK: Record<string, number> = { error: 4, warning: 3, success: 2, info: 1 };

function dominantSeverity(events: EventLog[]): EventSeverity {
  let bestRank = 0;
  let best: EventSeverity = 'info';
  for (const e of events) {
    const sev = (e.severity ?? 'info') as EventSeverity;
    const rank = SEVERITY_RANK[sev] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = sev;
    }
  }
  return best;
}

const GROUP_SEVERITY_STYLES: Record<EventSeverity, { chip: string; icon: React.ReactNode; rail: string }> = {
  success: {
    chip: 'border-status-green/30 bg-status-green/10 text-status-green',
    icon: <ShieldCheck className="h-3 w-3" />,
    rail: 'bg-status-green/40',
  },
  info: {
    chip: 'border-status-blue/30 bg-status-blue/10 text-status-blue',
    icon: <CircleDot className="h-3 w-3" />,
    rail: 'bg-status-blue/40',
  },
  warning: {
    chip: 'border-status-yellow/30 bg-status-yellow/10 text-status-yellow',
    icon: <AlertTriangle className="h-3 w-3" />,
    rail: 'bg-status-yellow/40',
  },
  error: {
    chip: 'border-status-red/30 bg-status-red/10 text-status-red',
    icon: <XCircle className="h-3 w-3" />,
    rail: 'bg-status-red/50',
  },
};

const SOURCE_BADGE: Record<EventSource, string> = {
  cloudflare: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  appscript: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  spiralfolio: 'border-accent/30 bg-accent-soft text-accent',
  manual: 'border-border-strong bg-surface-2 text-text-dim',
  zoom: 'border-cyan-500/35 bg-cyan-500/12 text-cyan-300',
};

/**
 * A group's "kind" is derived from the event types present in it. We name the
 * cluster after the most downstream / meaningful thing that happened so the
 * header reads as a sentence in the operator's mental model rather than as a
 * generic "related events" lump.
 */
type GroupKind = {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconWrap: string; // tailwind classes for the small icon tile
};

function classifyGroup(events: EventLog[]): GroupKind {
  const types = new Set(events.map(e => e.eventType));
  const has = (...needles: string[]) => needles.some(n => types.has(n));
  const hasPrefix = (prefix: string) => Array.from(types).some(t => t.startsWith(prefix));

  // 1. Client brain mutation — the SpiralFolio side of the pipeline.
  if (has('brain_changed', 'call_imported', 'transcript_uploaded')) {
    return {
      title: 'Client Brain Updated',
      description: 'Transcript ingested and client brain refreshed',
      icon: <Brain className="h-3.5 w-3.5" />,
      iconWrap: 'bg-accent-soft text-accent',
    };
  }

  // 2. Coaching doc + Slack DM dispatch.
  if (
    has('coaching_doc_created', 'appscript_processing_completed', 'appscript_processing_started') ||
    hasPrefix('slack_dm_')
  ) {
    return {
      title: 'Coaching Pipeline Ran',
      description: 'Apps Script generated coaching feedback and sent DMs',
      icon: <Sparkles className="h-3.5 w-3.5" />,
      iconWrap: 'bg-emerald-500/15 text-emerald-300',
    };
  }

  // 3. Skipped at the webhook stage (host check, internal, etc).
  if (has('appscript_processing_skipped')) {
    return {
      title: 'Call Skipped',
      description: 'Webhook received but not queued for processing',
      icon: <Slash className="h-3.5 w-3.5" />,
      iconWrap: 'bg-surface-2 text-text-muted',
    };
  }

  // 4. Webhook arrival — Zoom delivered an event via Cloudflare.
  if (hasPrefix('cloudflare_') || hasPrefix('zoom_')) {
    return {
      title: 'Call Detected',
      description: 'Zoom webhook received and forwarded by Cloudflare',
      icon: <PhoneCall className="h-3.5 w-3.5" />,
      iconWrap: 'bg-status-blue/15 text-status-blue',
    };
  }

  // 5. Anything else.
  return {
    title: 'Related Events',
    description: 'Events that share a meeting / call ID',
    icon: <Layers className="h-3.5 w-3.5" />,
    iconWrap: 'bg-surface-2 text-text-dim',
  };
}

function GroupedEventRow({ group }: { group: EventGroup }) {
  const [expanded, setExpanded] = React.useState(false);
  const all = [group.primary, ...group.others];
  const total = all.length;

  const sources = Array.from(
    new Set(all.map(e => (e.source ?? '') as EventSource).filter(Boolean)),
  );
  const sev = dominantSeverity(all);
  const sevStyle = GROUP_SEVERITY_STYLES[sev];
  const kind = classifyGroup(all);

  const meetingTopic =
    all.find(e => e.meetingTopic)?.meetingTopic ?? all.find(e => e.callId)?.callId ?? null;
  const clientName = all.find(e => e.clientName)?.clientName ?? null;
  const callDate = all.find(e => e.callDate)?.callDate ?? null;

  const times = all.map(e => toMs(e.createdAt));
  const earliest = new Date(Math.min(...times));
  const latest = new Date(Math.max(...times));
  const spanMin = Math.max(0, Math.round((latest.getTime() - earliest.getTime()) / 60_000));

  return (
    <li
      className={`overflow-hidden rounded-lg border bg-surface/40 transition ${
        expanded ? 'border-accent/40 shadow-[0_0_0_1px_rgba(99,102,241,0.18)]' : 'border-border/70 hover:border-border-strong'
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
          <div className={`mt-0.5 shrink-0 rounded-md p-1 ${kind.iconWrap}`}>
            {kind.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-text">{kind.title}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                <Layers className="h-3 w-3" />
                {total} events
              </span>
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              )}
            </div>
            <div className="mt-0.5 line-clamp-1 text-[12px] text-text-muted">
              {kind.description}
              {sources.length > 0 && (
                <>
                  {' · '}
                  <span className="text-text-dim">{sources.join(' → ')}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          {clientName && (
            <div className="truncate text-[12.5px] text-text">{clientName}</div>
          )}
          {meetingTopic && (
            <div className="truncate text-[11.5px] text-text-muted">{meetingTopic}</div>
          )}
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

        <div className="text-right">
          {kind.title === 'Call Skipped' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-text-muted">
              <Slash className="h-3 w-3" />
              Skipped
            </span>
          ) : (
            <span
              className={
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ' +
                sevStyle.chip
              }>
              {sevStyle.icon}
              {sev}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="relative border-t border-border/70 bg-bg/30">
          {/* Vertical accent rail — overlay so it never shifts the row grid */}
          <span
            aria-hidden
            className={`pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] ${sevStyle.rail}`}
          />
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
