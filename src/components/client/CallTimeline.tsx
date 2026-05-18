

import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Trophy,
  CircleDot,
  UserPlus,
  Pencil,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Tooltip } from '@/components/shared/Tooltip';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/shared/Button';
import { formatDate, cn, parseYYYYMMDDLocal, toLocalYYYYMMDD } from '@/lib/utils';
import type { BrainCallLogEntry, CallChanges } from '@/lib/types/brain';
import { apiFetch } from '@/lib/api';

const CALL_TYPES = ['kickoff', 'weekly', 'ad-hoc', 'review'] as const;

const dateInputClass =
  'w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none';

export function CallTimeline({ entries, clientId }: { entries: BrainCallLogEntry[]; clientId: string }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No calls yet."
        description="Upload a transcript above to start building this client's brain."
      />
    );
  }
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
      {sorted.map((e, i) => (
        <CallRow key={e.id ?? `${e.date}-${i}`} entry={e} clientId={clientId} />
      ))}
    </div>
  );
}

function CallRow({ entry, clientId }: { entry: BrainCallLogEntry; clientId: string }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => parseYYYYMMDDLocal(entry.date));
  const [callType, setCallType] = useState(entry.type ?? 'weekly');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const summary = changeSummary(entry.changes);
  const canEdit = Boolean(entry.id);

  useEffect(() => {
    setSelectedDate(parseYYYYMMDDLocal(entry.date));
    setCallType(entry.type ?? 'weekly');
  }, [entry.date, entry.type]);

  const resetEdit = () => {
    setSelectedDate(parseYYYYMMDDLocal(entry.date));
    setCallType(entry.type ?? 'weekly');
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!entry.id) return;
    setSaving(true);
    setEditError(null);
    try {
      const apiKey = import.meta.env.VITE_SPIRALFOLIO_API_KEY ?? '';
      const res = await apiFetch(`/api/calls/${entry.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          client_id: clientId,
          call_date: toLocalYYYYMMDD(selectedDate),
          call_type: callType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Update failed');
      setEditOpen(false);
      window.location.reload();
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
        {open ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 text-text-muted" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-text-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="stat-num text-[12px] text-text-muted">{formatDate(entry.date)}</span>
            {entry.type && <StatusBadge status={entry.type} size="xs" />}
            {canEdit && (
              <Popover.Root
                open={editOpen}
                onOpenChange={o => {
                  setEditOpen(o);
                  if (!o) resetEdit();
                }}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    title="Edit call date"
                    onClick={ev => {
                      ev.stopPropagation();
                      setEditOpen(true);
                    }}
                    className="inline-flex rounded p-0.5 text-text-muted hover:bg-surface-2 hover:text-text">
                    <Pencil className="h-3 w-3" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    className="z-[60] w-[min(100vw-2rem,20rem)] rounded-lg border border-border bg-surface p-3 shadow-2xl"
                    onClick={ev => ev.stopPropagation()}>
                    <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                      Call details
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">Date</div>
                        <div className="rounded-md border border-border p-1">
                          <DayPicker
                            mode="single"
                            selected={selectedDate}
                            onSelect={d => {
                              if (d) setSelectedDate(d);
                            }}
                            showOutsideDays
                            classNames={{
                              root: 'p-2 select-none',
                              months: 'flex flex-col',
                              month: 'space-y-3',
                              month_caption: 'flex items-center justify-between px-1 mb-1',
                              caption_label: 'text-[13px] font-semibold text-text',
                              nav: 'flex items-center gap-1',
                              button_previous:
                                'flex h-6 w-6 items-center justify-center rounded-md border border-border text-text-muted hover:bg-surface-2 hover:text-text',
                              button_next:
                                'flex h-6 w-6 items-center justify-center rounded-md border border-border text-text-muted hover:bg-surface-2 hover:text-text',
                              month_grid: 'w-full border-collapse',
                              weekdays: 'flex',
                              weekday:
                                'w-8 text-center text-[10px] font-medium uppercase tracking-wider text-text-muted pb-1',
                              week: 'flex mt-1',
                              day: 'h-8 w-8',
                              day_button:
                                'h-8 w-8 rounded-md text-[12px] text-text hover:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-accent',
                              selected: '[&>button]:bg-accent [&>button]:text-white [&>button]:hover:bg-accent',
                              today: '[&>button]:border [&>button]:border-accent/60 [&>button]:text-accent',
                              outside: '[&>button]:text-text-muted/40',
                              disabled: '[&>button]:opacity-30 [&>button]:pointer-events-none',
                            }}
                            components={{
                              Chevron: ({ orientation }) =>
                                orientation === 'left' ? (
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                ),
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] uppercase tracking-wider text-text-muted">
                          Type
                        </label>
                        <select
                          value={callType}
                          onChange={e => setCallType(e.target.value)}
                          className={dateInputClass}>
                          {CALL_TYPES.map(t => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      {editError && <div className="text-[11px] text-status-red">{editError}</div>}
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            resetEdit();
                            setEditOpen(false);
                          }}>
                          Cancel
                        </Button>
                        <Button type="button" variant="primary" size="sm" disabled={saving} onClick={saveEdit}>
                          {saving ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" /> Save
                            </>
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            )}
            {summary.length > 0 && (
              <div className="ml-0.5 flex flex-wrap items-center gap-1">
                {summary.map(s => (
                  <Tooltip key={s.key} content={s.tooltip}>
                    <span
                      className={cn(
                        'inline-flex max-w-[9.5rem] cursor-help items-center gap-0.5 rounded-md border px-1 py-0.5 text-[9px] font-medium leading-tight sm:max-w-none',
                        s.tone,
                      )}>
                      {s.icon}
                      <span className="min-w-0">{s.label}</span>
                    </span>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>
          {entry.summary && <div className="mt-1 truncate text-[13px] text-text">{entry.summary}</div>}
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-9 py-3 text-[12px] text-text-dim">
          {entry.summary && <p className="mb-3 leading-relaxed text-text">{entry.summary}</p>}
          {!!entry.changes?.notes?.length && (
            <div className="mb-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">Brain changes</div>
              <ul className="space-y-0.5 pl-1 text-text">
                {entry.changes.notes.map((n, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 inline-block h-1 w-1 flex-shrink-0 rounded-full bg-accent" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!entry.key_updates?.length && (
            <div className="mb-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">Key updates</div>
              <ul className="list-disc space-y-0.5 pl-5">
                {entry.key_updates.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {!!entry.attendees_client?.length && (
              <Section label="Client attendees" items={entry.attendees_client} />
            )}
            {!!entry.attendees_internal?.length && (
              <Section label="Internal attendees" items={entry.attendees_internal} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type ChangePill = {
  key: string;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
  tone: string;
};

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** One explicit pill per brain counter so labels match what moved on the account. */
function changeSummary(c: CallChanges | undefined): ChangePill[] {
  if (!c) return [];
  const out: ChangePill[] = [];

  if (c.concerns_added) {
    out.push({
      key: 'concerns-new',
      label: plural(c.concerns_added, 'new concern', 'new concerns'),
      tooltip: 'Brand-new open concerns extracted from this call’s transcript.',
      icon: <AlertTriangle className="h-2.5 w-2.5 shrink-0" />,
      tone: 'border-status-yellow/35 bg-status-yellow/10 text-status-yellow',
    });
  }
  if (c.concerns_resolved) {
    out.push({
      key: 'concerns-resolved',
      label: plural(c.concerns_resolved, 'concern completed', 'concerns completed'),
      tooltip: 'Concerns cleared or closed after this call (resolved in the brain).',
      icon: <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />,
      tone: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400',
    });
  }
  if (c.concerns_extended) {
    out.push({
      key: 'concerns-updated',
      label: plural(c.concerns_extended, 'concern updated', 'concerns updated'),
      tooltip: 'Existing concerns revised (owner, status, blocker, or notes).',
      icon: <RefreshCw className="h-2.5 w-2.5 shrink-0" />,
      tone: 'border-sky-500/35 bg-sky-500/10 text-sky-400',
    });
  }
  if (c.deliverables_added) {
    out.push({
      key: 'deliverables-new',
      label: plural(c.deliverables_added, 'new deliverable', 'new deliverables'),
      tooltip: 'New deliverable rows added from this call.',
      icon: <Sparkles className="h-2.5 w-2.5 shrink-0" />,
      tone: 'border-accent/35 bg-accent/10 text-accent',
    });
  }
  if (c.deliverables_completed) {
    out.push({
      key: 'deliverables-done',
      label: plural(c.deliverables_completed, 'deliverable completed', 'deliverables completed'),
      tooltip: 'Deliverables marked done after this call.',
      icon: <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />,
      tone: 'border-status-green/35 bg-status-green/10 text-status-green',
    });
  }
  const deliverablesUpdated = c.deliverables_extended + c.deliverables_status_changed;
  if (deliverablesUpdated) {
    out.push({
      key: 'deliverables-updated',
      label: plural(deliverablesUpdated, 'deliverable updated', 'deliverables updated'),
      tooltip: 'Existing deliverables changed (details, status, owner, or due date).',
      icon: <RefreshCw className="h-2.5 w-2.5 shrink-0" />,
      tone: 'border-status-blue/35 bg-status-blue/10 text-status-blue',
    });
  }
  if (c.decisions_added) {
    out.push({
      key: 'decisions',
      label: plural(c.decisions_added, 'decision', 'decisions'),
      tooltip: 'Decisions recorded from this call (Overview → Decisions by call).',
      icon: <CircleDot className="h-2.5 w-2.5 shrink-0" />,
      tone: 'border-violet-400/35 bg-violet-500/12 text-violet-300',
    });
  }
  if (c.wins_added) {
    out.push({
      key: 'wins',
      label: plural(c.wins_added, 'win', 'wins'),
      tooltip: 'Wins logged from this call (Overview → Wins by call).',
      icon: <Trophy className="h-2.5 w-2.5 shrink-0" />,
      tone: 'border-lime-500/35 bg-lime-500/10 text-lime-400',
    });
  }
  if (c.contacts_added) {
    out.push({
      key: 'contacts',
      label: plural(c.contacts_added, 'contact added', 'contacts added'),
      tooltip: 'Client or stakeholder contacts added from this call.',
      icon: <UserPlus className="h-2.5 w-2.5 shrink-0" />,
      tone: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
    });
  }

  return out;
}

function Section({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-[12px] text-text">{items.join(', ')}</div>
    </div>
  );
}
