
import { useEffect, useMemo, useState } from 'react';
import { cn, formatSessionDate, normalizeCallDateKey } from '@/lib/utils';

export type GroupableCallEntry = {
  id?: string;
  text: string;
  call_date?: string;
};

function sortGroupsDescending(dates: string[]): string[] {
  const undated = dates.filter(d => d === '__undated');
  const dated = dates.filter(d => d !== '__undated').sort((a, b) => (a < b ? 1 : -1));
  return [...dated, ...undated];
}

function groupEntries<T extends GroupableCallEntry>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = normalizeCallDateKey(item.call_date) ?? '__undated';
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function dateLabel(dateKey: string): string {
  if (dateKey === '__undated') return 'Earlier / undated';
  return formatSessionDate(dateKey);
}

export function CallGroupedEntries({
  items,
  variant,
  emptyTitle,
  emptyDescription,
}: {
  items: GroupableCallEntry[];
  variant: 'wins' | 'decisions';
  emptyTitle: string;
  emptyDescription?: string;
}) {
  const grouped = useMemo(() => groupEntries(items), [items]);
  const orderedDates = useMemo(() => sortGroupsDescending([...grouped.keys()]), [grouped]);
  const dateKeySignature = useMemo(() => orderedDates.join('|'), [orderedDates]);

  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [dateKeySignature]);

  const activeKey =
    selected !== null && grouped.has(selected) ? selected : orderedDates[0] ?? null;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-[13px] text-text-muted">{emptyTitle}</p>
        {emptyDescription && <p className="mt-1 max-w-xs text-[12px] text-text-dim">{emptyDescription}</p>}
      </div>
    );
  }

  const bullet =
    variant === 'wins'
      ? 'bg-status-green shadow-[0_0_0_3px_rgba(34,197,94,0.15)]'
      : 'bg-accent shadow-[0_0_0_3px_rgba(99,102,241,0.18)]';

  const rows = activeKey ? (grouped.get(activeKey) ?? []) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {orderedDates.map(dateKey => {
          const n = (grouped.get(dateKey) ?? []).length;
          const label = dateLabel(dateKey);
          const isActive = dateKey === activeKey;
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => setSelected(dateKey)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-left text-[11px] font-medium transition',
                isActive
                  ? 'border-accent bg-accent/15 text-text shadow-[inset_0_0_0_1px_rgba(99,102,241,0.35)]'
                  : 'border-border bg-surface-2 text-text-muted hover:border-border-strong hover:text-text',
              )}>
              <span className="whitespace-nowrap">{label}</span>
              <span
                className={cn(
                  'ml-1.5 tabular-nums opacity-80',
                  isActive ? 'text-text-dim' : 'text-text-muted',
                )}>
                ({n})
              </span>
            </button>
          );
        })}
      </div>

      <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        {rows.map((row, i) => (
          <li
            key={row.id ?? `${activeKey}-${i}`}
            className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2.5">
            <span className={cn('mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full', bullet)} />
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-text">{row.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
