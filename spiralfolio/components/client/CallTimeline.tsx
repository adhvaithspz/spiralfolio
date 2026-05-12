'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/utils';
import type { BrainCallLogEntry } from '@/lib/db/brain';

export function CallTimeline({ entries }: { entries: BrainCallLogEntry[] }) {
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
    <div className="space-y-2">
      {sorted.map((e, i) => (
        <CallRow key={`${e.date}-${i}`} entry={e} />
      ))}
    </div>
  );
}

function CallRow({ entry }: { entry: BrainCallLogEntry }) {
  const [open, setOpen] = useState(false);
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
          <div className="flex items-center gap-2">
            <span className="stat-num text-[12px] text-text-muted">{formatDate(entry.date)}</span>
            {entry.type && <StatusBadge status={entry.type} size="xs" />}
          </div>
          {entry.summary && <div className="mt-1 truncate text-[13px] text-text">{entry.summary}</div>}
        </div>
      </button>
      {open && (
        <div className="border-t border-border px-9 py-3 text-[12px] text-text-dim">
          {entry.summary && <p className="mb-3 leading-relaxed text-text">{entry.summary}</p>}
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

function Section({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-[12px] text-text">{items.join(', ')}</div>
    </div>
  );
}
