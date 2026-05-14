'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Filter,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { EmptyState } from '@/components/shared/EmptyState';
import { EventRow } from './EventRow';
import { AdminLogoutButton } from './AdminLogoutButton';
import type { EventLog, EventSeverity, EventSource } from '@/lib/db/schema';
import type { EventCountSummary } from '@/lib/db/events';

type Filters = {
  eventTypes: string[];
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
  const [draft, setDraft] = React.useState<Filters>(initialFilters);

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
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
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

      <FilterPanel
        draft={draft}
        setDraft={setDraft}
        knownEventTypes={knownEventTypes}
        clients={clients}
        onApply={() => applyFilters(draft)}
        onReset={() =>
          applyFilters({
            eventTypes: [],
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

      <div className="rounded-xl border border-border surface-glass">
        <div className="grid grid-cols-[150px_minmax(0,2fr)_minmax(0,1fr)_120px_120px] items-center gap-3 border-b border-border px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          <div>Time</div>
          <div>Event</div>
          <div>Client / Meeting</div>
          <div>Source</div>
          <div className="text-right">Severity</div>
        </div>
        {rows.length === 0 ? (
          <div className="p-10">
            <EmptyState
              title="No events match those filters."
              description="Trigger a Zoom webhook or upload a transcript to see entries appear here."
            />
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {rows.map(row => (
              <EventRow key={row.id} row={row} />
            ))}
          </ol>
        )}
        {cursor && (
          <div className="flex items-center justify-center border-t border-border p-3">
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

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChipGroup
          label="Source"
          options={ALL_SOURCES}
          selected={draft.sources}
          onToggle={v => setDraft(d => ({ ...d, sources: toggleArray(d.sources, v) }))}
        />
        <ChipGroup
          label="Severity"
          options={ALL_SEVERITIES}
          selected={draft.severities}
          onToggle={v => setDraft(d => ({ ...d, severities: toggleArray(d.severities, v) }))}
        />
        <ChipGroup
          label="Event type"
          options={knownEventTypes.map(t => ({ value: t, label: t }))}
          selected={draft.eventTypes}
          onToggle={v => setDraft(d => ({ ...d, eventTypes: toggleArray(d.eventTypes, v) }))}
        />
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
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
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
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition ' +
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
