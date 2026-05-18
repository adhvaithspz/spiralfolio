import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** YYYY-MM-DD in the user's local calendar (date pickers — avoids UTC day shift vs toISOString). */
export function toLocalYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string into a local-midnight Date for calendar components. */
export function parseYYYYMMDDLocal(s: string): Date {
  const [y, mo, day] = s.split('-').map(Number);
  if (!y || !mo || !day) return new Date(NaN);
  return new Date(y, mo - 1, day);
}

/**
 * Canonical `YYYY-MM-DD` for grouping brain entries by call session day.
 * Plain calendar strings pass through; full ISO timestamps map to the user's **local** date.
 */
export function normalizeCallDateKey(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return null;
  return toLocalYYYYMMDD(new Date(t));
}

const MS_PER_DAY = 86_400_000;

function localMidnightFrom(ref: Date): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
}

/**
 * Whole calendar days between a call session date and "today", in the user's local TZ.
 * Use for `YYYY-MM-DD` call dates from the DB.
 */
export function sessionDateAgeDays(callDateISO: string | null | undefined): number | null {
  if (!callDateISO) return null;
  let callMs: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(callDateISO)) {
    callMs = parseYYYYMMDDLocal(callDateISO).getTime();
  } else {
    const t = new Date(callDateISO).getTime();
    if (Number.isNaN(t)) return null;
    const d = new Date(t);
    callMs = localMidnightFrom(d).getTime();
  }
  const todayMs = localMidnightFrom(new Date()).getTime();
  return Math.floor((todayMs - callMs) / MS_PER_DAY);
}

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * History / call rows store session date as YYYY-MM-DD — format in local calendar
 * (avoids UTC parsing drift from `new Date('YYYY-MM-DD')`).
 */
export function formatSessionDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return parseYYYYMMDDLocal(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return formatDate(isoDate);
}

/**
 * For brain history: show the **meeting / call session** date when present;
 * otherwise fall back to relative time from when the row was logged (`at`).
 */
export function historyEntryWhenLabel(entry: { call_date?: string; at: string }): string {
  if (entry.call_date) return formatSessionDate(entry.call_date);
  return relativeTime(entry.at);
}

/**
 * Rolling calendar window for cadence bucket `bucketIndex`:
 * index `0` = oldest column, `buckets - 1` = most recent slice ending today (local date).
 */
export function cadenceBucketRangeLabel(
  bucketIndex: number,
  buckets: number,
  bucketDays: number,
  now = new Date(),
): string {
  const idxFromEnd = buckets - 1 - bucketIndex;
  const newerDaysAgo = idxFromEnd * bucketDays;
  const olderDaysAgo = (idxFromEnd + 1) * bucketDays - 1;
  const tStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - olderDaysAgo);
  const tEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - newerDaysAgo);
  const opt: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const left =
    tStart.getFullYear() !== tEnd.getFullYear()
      ? tStart.toLocaleDateString('en-US', { ...opt, year: 'numeric' })
      : tStart.toLocaleDateString('en-US', opt);
  const right = tEnd.toLocaleDateString('en-US', { ...opt, year: 'numeric' });
  return `${left} – ${right}`;
}

export function relativeTime(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return String(input);
  const diffMs = d.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diffDays) < 1) return rtf.format(Math.round(diffMs / (1000 * 60 * 60)), 'hour');
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day');
  return rtf.format(Math.round(diffDays / 30), 'month');
}
