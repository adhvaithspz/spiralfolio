import { Target, AlertTriangle, ArrowUpFromLine, ArrowDownToLine, Trophy, CalendarDays } from 'lucide-react';
import type { BrainStats } from '@/lib/brain-stats';
import type { ClientBrain } from '@/lib/db/brain';
import { cn, cadenceBucketRangeLabel, formatSessionDate, sessionDateAgeDays } from '@/lib/utils';
import { Tooltip } from '@/components/shared/Tooltip';

const HEATMAP_WEEKS = 16;
const HEATMAP_BUCKET_DAYS = 7;

type BucketDateRow = { display: string; count: number };

function bucketDateSummary(rawDates: string[]): BucketDateRow[] {
  const m = new Map<string, number>();
  for (const iso of rawDates) {
    if (!iso) continue;
    m.set(iso, (m.get(iso) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, n]) => ({ display: formatSessionDate(iso), count: n }));
}

function buildCadenceData(
  brain: ClientBrain,
  weeks: number,
  bucketDays: number,
): { counts: number[]; dateSummaries: BucketDateRow[][] } {
  const counts = new Array<number>(weeks).fill(0);
  const rawPerBucket: string[][] = Array.from({ length: weeks }, () => []);

  for (const entry of brain.call_log ?? []) {
    const iso = entry.date;
    if (!iso) continue;
    const ageDays = sessionDateAgeDays(iso);
    if (ageDays === null || ageDays < 0) continue;
    const idxFromEnd = Math.floor(ageDays / bucketDays);
    if (idxFromEnd < 0 || idxFromEnd >= weeks) continue;
    const bucketIndex = weeks - 1 - idxFromEnd;
    counts[bucketIndex]++;
    rawPerBucket[bucketIndex].push(iso);
  }

  const dateSummaries = rawPerBucket.map(bucketDateSummary);
  return { counts, dateSummaries };
}

/**
 * The signature visual on every client page. Replaces the four small stat
 * tiles with a richer compound block:
 *   - Left: 16-week call activity heatmap with weekly counts
 *   - Centre: circular gauge for days-since-last-call (recency)
 *   - Right: vertical progress meters for the four core counters
 */
export function MomentumPanel({ stats, brain, wins }: { stats: BrainStats; brain: ClientBrain; wins: number }) {
  const cadence = buildCadenceData(brain, HEATMAP_WEEKS, HEATMAP_BUCKET_DAYS);
  const since = stats.lastCallDate ? sessionDateAgeDays(stats.lastCallDate) : null;
  const recencyPct = since === null ? 0 : Math.max(0, Math.min(100, Math.round(((30 - since) / 30) * 100)));
  const recencyTone =
    since === null
      ? 'text-text-muted'
      : since <= 14
        ? 'text-status-green'
        : since <= 30
          ? 'text-status-yellow'
          : 'text-status-red';
  const recencyColor = since === null ? '#71717a' : since <= 14 ? '#22c55e' : since <= 30 ? '#eab308' : '#ef4444';

  return (
    <section className="overflow-hidden rounded-xl border border-border surface-glass max-lg:rounded-lg 2xl:rounded-2xl">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px_240px] 2xl:grid-cols-[1fr_220px_280px] min-[1920px]:grid-cols-[1fr_240px_300px]">
        <div className="border-b border-border p-2 sm:p-3 max-lg:pb-2 lg:border-b-0 lg:border-r lg:p-4 2xl:p-5 min-[1920px]:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-dim sm:text-[11.5px] min-[1920px]:text-[12px]">
                Call Cadence
              </h3>
              <p className="mt-0.5 text-[10px] text-text-muted sm:text-[11px] min-[1920px]:text-[12px]">
                <span className="lg:hidden">
                  {HEATMAP_WEEKS} wk · {stats.callCount} call{stats.callCount === 1 ? '' : 's'}
                </span>
                <span className="hidden lg:inline">
                  Last {HEATMAP_WEEKS} rolling weeks · <span className="text-text-dim">{stats.callCount}</span>{' '}
                  processed call
                  {stats.callCount === 1 ? '' : 's'}{' '}
                  <span className="text-text-muted/70">(by scheduled meeting date)</span>
                </span>
              </p>
            </div>
            <div className="hidden shrink-0 flex-col items-end gap-0.5 text-right sm:flex">
              <span className="text-[10px] text-text-muted">
                Shade = calls <span className="text-text-dim">in that slice</span>
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                <span>fewer</span>
                <Legend tone="bg-bg ring-soft" />
                <Legend tone="bg-accent/35" />
                <Legend tone="bg-accent/65" />
                <Legend tone="bg-accent" />
                <span>more</span>
              </div>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1 text-[8.5px] text-text-muted sm:hidden">
            <span>Purple = busier</span>
            <span className="opacity-60">·</span>
            <span>fewer</span>
            <Legend tone="bg-bg ring-soft" />
            <Legend tone="bg-accent/35" />
            <Legend tone="bg-accent/65" />
            <Legend tone="bg-accent" />
            <span>more</span>
          </div>

          <Heatmap
            buckets={cadence.counts}
            dateSummaries={cadence.dateSummaries}
            weeks={HEATMAP_WEEKS}
            bucketDays={HEATMAP_BUCKET_DAYS}
          />
        </div>

        <div className="flex flex-col items-center justify-center border-b border-border p-2 sm:p-3 max-lg:flex-row max-lg:flex-wrap max-lg:justify-center max-lg:gap-3 max-lg:py-2 lg:flex-col lg:border-b-0 lg:border-r lg:p-4 lg:py-4 2xl:p-5 min-[1920px]:p-6">
          <RecencyGauge pct={recencyPct} color={recencyColor} since={since} tone={recencyTone} />
          <div className="mt-2 text-center sm:mt-3 max-lg:mt-0 max-lg:text-left lg:mt-2 lg:text-center 2xl:mt-3">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted sm:text-[10px] min-[1920px]:text-[11px]">
              Last contact
            </div>
            <div className={`stat-num mt-0.5 text-[11px] sm:mt-1 sm:text-[12px] min-[1920px]:text-[13px] ${recencyTone}`}>
              {since === null ? 'No calls yet' : since === 0 ? 'Today' : `${since} day${since === 1 ? '' : 's'} ago`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border/40 p-px">
          <Meter label="Goals" value={stats.goals} icon={<Target className="h-3 w-3" />} tone="default" />
          <Meter
            label="Open concerns"
            value={stats.openConcerns}
            icon={<AlertTriangle className="h-3 w-3" />}
            tone={stats.openConcerns > 0 ? 'yellow' : 'default'}
          />
          <Meter
            label="We owe"
            value={stats.ourPending}
            icon={<ArrowUpFromLine className="h-3 w-3" />}
            tone={stats.ourPending > 0 ? 'blue' : 'default'}
          />
          <Meter
            label="They owe"
            value={stats.theirPending}
            icon={<ArrowDownToLine className="h-3 w-3" />}
            tone={stats.theirPending > 0 ? 'blue' : 'default'}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border bg-surface/60 px-2 py-1 text-[8.5px] text-text-muted sm:gap-1.5 sm:px-4 sm:py-2 sm:text-[10px] max-lg:py-1.5 2xl:px-5 2xl:py-2.5 2xl:text-[11px] min-[1920px]:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3" />
            <span>
              {stats.callCount} processed call{stats.callCount === 1 ? '' : 's'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Trophy className="h-3 w-3 text-status-green" />
            <span>
              {wins} win{wins === 1 ? '' : 's'} logged
            </span>
          </span>
        </div>
        <div className="max-w-[42%] text-right text-[9px] uppercase tracking-[0.12em] text-text-muted sm:max-w-none sm:text-[10px] sm:tracking-[0.14em]">
          <span className="sm:hidden">On transcript ingest</span>
          <span className="hidden sm:inline">Updated when transcripts are processed</span>
        </div>
      </div>
    </section>
  );
}

function Heatmap({
  buckets,
  dateSummaries,
  weeks,
  bucketDays,
}: {
  buckets: number[];
  dateSummaries: BucketDateRow[][];
  weeks: number;
  bucketDays: number;
}) {
  const max = Math.max(1, ...buckets);
  const now = new Date();

  return (
    <div className="mt-1.5 sm:mt-3 lg:mt-6 2xl:mt-8 min-[1920px]:mt-10">
      <div className="flex items-end gap-1 sm:gap-1.5" role="img" aria-label="Call cadence by week bucket">
        {buckets.map((count, i) => {
          const intensity = count === 0 ? 0 : count / max;
          const isLatest = i === buckets.length - 1;
          const range = cadenceBucketRangeLabel(i, weeks, bucketDays, now);
          const rows = dateSummaries[i] ?? [];
          const bgClass =
            count === 0
              ? 'bg-bg ring-soft'
              : intensity > 0.66
                ? isLatest
                  ? 'bg-accent shadow-[0_0_0_3px_rgba(99,102,241,0.18)]'
                  : 'bg-accent'
                : intensity > 0.33
                  ? 'bg-accent/65'
                  : 'bg-accent/35';
          const ariaCalls =
            count === 0
              ? 'No calls.'
              : rows
                  .map(r => (r.count > 1 ? `${r.display} (${r.count} calls)` : r.display))
                  .join('; ');
          return (
            <Tooltip
              key={i}
              side="top"
              content={
                <div className="space-y-2 text-left">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      This column covers
                    </div>
                    <div className="text-[13px] font-medium leading-tight text-text">{range}</div>
                  </div>
                  {count === 0 ? (
                    <div className="text-[11px] text-text-muted">No calls in this slice</div>
                  ) : (
                    <>
                      <div className="border-t border-border pt-2 text-[11px] text-text-muted">
                        Scheduled call date{count !== 1 ? 's' : ''} ({count})
                      </div>
                      <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                        {rows.map((r, j) => (
                          <li key={j} className="flex items-baseline gap-1.5 text-[11px] text-text leading-snug">
                            <span className="font-medium">{r.display}</span>
                            {r.count > 1 && (
                              <span className="text-[10px] text-text-muted">{r.count}×</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              }>
              <button
                type="button"
                aria-label={`${range}. ${ariaCalls}`}
                className={cn(
                  'group relative flex min-w-0 flex-1 flex-col items-center rounded-md',
                  'border-0 bg-transparent p-0 text-left outline-none cursor-default',
                  'focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                )}>
                <div className={`h-4 w-full rounded sm:h-6 md:h-8 lg:h-8 2xl:h-10 ${bgClass} transition group-hover:ring-2 group-hover:ring-accent/30`} />
                <span
                  className={cn(
                    'stat-num mt-0.5 min-h-[10px] text-[8px] tabular-nums sm:mt-0.5 sm:min-h-[12px] sm:text-[9px] md:text-[10px]',
                    count === 0 ? 'text-text-muted/35' : 'text-text-dim',
                  )}>
                  {count === 0 ? '—' : count}
                </span>
              </button>
            </Tooltip>
          );
        })}
      </div>

      <div className="mt-px flex justify-between px-px text-[9px] text-text-muted">
        <span>Farthest back</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Legend({ tone }: { tone: string }) {
  return <span className={`inline-block h-2 w-2 rounded-sm ${tone}`} />;
}

function RecencyGauge({ pct, color, since, tone }: { pct: number; color: string; since: number | null; tone: string }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <div className="relative h-14 w-14 sm:h-16 sm:w-16 lg:h-24 lg:w-24 2xl:h-[110px] 2xl:w-[110px] min-[1920px]:h-[120px] min-[1920px]:w-[120px]">
      <svg viewBox="-60 -60 120 120" className="h-full w-full -rotate-90">
        <circle cx="0" cy="0" r={R} fill="none" stroke="#1c1c22" strokeWidth={10} />
        <circle
          cx="0"
          cy="0"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C - dash}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={`stat-num text-[14px] font-semibold leading-none sm:text-[16px] lg:text-[18px] 2xl:text-[22px] min-[1920px]:text-[26px] ${tone}`}>
          {since === null ? '—' : since}
        </span>
        <span className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.14em] text-text-muted sm:text-[9px]">
          {since === 1 ? 'day' : 'days'}
        </span>
      </div>
    </div>
  );
}

const TONE_TEXT = {
  default: 'text-text',
  yellow: 'text-status-yellow',
  blue: 'text-status-blue',
  red: 'text-status-red',
  green: 'text-status-green',
} as const;

const TONE_BAR = {
  default: 'bg-border-strong',
  yellow: 'bg-status-yellow',
  blue: 'bg-status-blue',
  red: 'bg-status-red',
  green: 'bg-status-green',
} as const;

function Meter({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: keyof typeof TONE_TEXT;
}) {
  const filled = Math.min(value, 8);
  return (
    <div className="bg-surface px-1.5 py-1.5 sm:px-3 sm:py-2.5 max-lg:py-1.5 2xl:px-3.5 2xl:py-3 min-[1920px]:px-4">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted sm:text-[10px] min-[1920px]:text-[11px]">
          {label}
        </span>
        <span className={`${TONE_TEXT[tone]}`}>{icon}</span>
      </div>
      <div className={`stat-num mt-0.5 text-[14px] font-semibold leading-none sm:mt-1 sm:text-[17px] md:text-[18px] min-[1920px]:text-[22px] ${TONE_TEXT[tone]}`}>
        {value}
      </div>
      <div className="mt-1 flex gap-px sm:mt-1.5 sm:gap-[2px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition ${i < filled ? TONE_BAR[tone] : 'bg-border'}`}
            style={{ opacity: i < filled ? 1 - i * 0.08 : 1 }}
          />
        ))}
      </div>
    </div>
  );
}
