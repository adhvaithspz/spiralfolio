import {
  Target,
  AlertTriangle,
  ArrowUpFromLine,
  ArrowDownToLine,
  Trophy,
  CalendarDays,
} from 'lucide-react';
import type { BrainStats } from '@/lib/brain-stats';
import type { ClientBrain } from '@/lib/db/brain';

const HEATMAP_WEEKS = 16;
const HEATMAP_BUCKET_DAYS = 7;

function buildHeatmap(brain: ClientBrain): number[] {
  const out = new Array<number>(HEATMAP_WEEKS).fill(0);
  const now = Date.now();
  for (const entry of brain.call_log ?? []) {
    const t = new Date(entry.date).getTime();
    if (Number.isNaN(t)) continue;
    const ageDays = Math.floor((now - t) / (1000 * 60 * 60 * 24));
    const idxFromEnd = Math.floor(ageDays / HEATMAP_BUCKET_DAYS);
    if (idxFromEnd < 0 || idxFromEnd >= HEATMAP_WEEKS) continue;
    out[HEATMAP_WEEKS - 1 - idxFromEnd]++;
  }
  return out;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

/**
 * The signature visual on every client page. Replaces the four small stat
 * tiles with a richer compound block:
 *   - Left: 16-week call activity heatmap with weekly counts
 *   - Centre: circular gauge for days-since-last-call (recency)
 *   - Right: vertical progress meters for the four core counters
 */
export function MomentumPanel({
  stats,
  brain,
  wins,
}: {
  stats: BrainStats;
  brain: ClientBrain;
  wins: number;
}) {
  const heatmap = buildHeatmap(brain);
  const since = daysSince(stats.lastCallDate);
  const recencyPct =
    since === null ? 0 : Math.max(0, Math.min(100, Math.round(((30 - since) / 30) * 100)));
  const recencyTone =
    since === null
      ? 'text-text-muted'
      : since <= 14
        ? 'text-status-green'
        : since <= 30
          ? 'text-status-yellow'
          : 'text-status-red';
  const recencyColor =
    since === null
      ? '#71717a'
      : since <= 14
        ? '#22c55e'
        : since <= 30
          ? '#eab308'
          : '#ef4444';

  return (
    <section className="overflow-hidden rounded-2xl border border-border surface-glass">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_280px]">
        <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-baseline justify-between">
            <div>
              <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                Call Cadence
              </h3>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {HEATMAP_WEEKS} weeks · {stats.callCount} call{stats.callCount === 1 ? '' : 's'} total
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <span>less</span>
              <Legend tone="bg-bg ring-soft" />
              <Legend tone="bg-accent/35" />
              <Legend tone="bg-accent/65" />
              <Legend tone="bg-accent" />
              <span>more</span>
            </div>
          </div>

          <Heatmap buckets={heatmap} />
        </div>

        <div className="flex flex-col items-center justify-center border-b border-border p-5 lg:border-b-0 lg:border-r">
          <RecencyGauge pct={recencyPct} color={recencyColor} since={since} tone={recencyTone} />
          <div className="mt-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Last contact
            </div>
            <div className={`stat-num mt-1 text-[12px] ${recencyTone}`}>
              {since === null
                ? 'No calls yet'
                : since === 0
                  ? 'Today'
                  : `${since} day${since === 1 ? '' : 's'} ago`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border/40 p-px">
          <Meter
            label="Goals"
            value={stats.goals}
            icon={<Target className="h-3 w-3" />}
            tone="default"
          />
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

      <div className="flex items-center justify-between border-t border-border bg-surface/60 px-5 py-2.5 text-[11px] text-text-muted">
        <div className="flex items-center gap-4">
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
        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
          Updated when transcripts are processed
        </div>
      </div>
    </section>
  );
}

function Heatmap({ buckets }: { buckets: number[] }) {
  const max = Math.max(1, ...buckets);
  return (
    <div className="mt-4 flex items-end gap-1.5">
      {buckets.map((count, i) => {
        const intensity = count === 0 ? 0 : count / max;
        const isLatest = i === buckets.length - 1;
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
        return (
          <div key={i} className="group relative flex flex-1 flex-col items-center">
            <div className={`h-10 w-full rounded-md ${bgClass} transition`} title={`${count} call${count === 1 ? '' : 's'}`} />
            {count > 0 && (
              <span className="stat-num mt-1 text-[10px] text-text-dim">{count}</span>
            )}
            {count === 0 && <span className="mt-1 text-[10px] text-text-muted/50">·</span>}
          </div>
        );
      })}
    </div>
  );
}

function Legend({ tone }: { tone: string }) {
  return <span className={`inline-block h-2 w-2 rounded-sm ${tone}`} />;
}

function RecencyGauge({
  pct,
  color,
  since,
  tone,
}: {
  pct: number;
  color: string;
  since: number | null;
  tone: string;
}) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <div className="relative h-[120px] w-[120px]">
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
        <span className={`stat-num text-[26px] font-semibold leading-none ${tone}`}>
          {since === null ? '—' : since}
        </span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-text-muted">
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
    <div className="bg-surface px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {label}
        </span>
        <span className={`${TONE_TEXT[tone]}`}>{icon}</span>
      </div>
      <div className={`stat-num mt-1.5 text-[22px] font-semibold leading-none ${TONE_TEXT[tone]}`}>
        {value}
      </div>
      <div className="mt-2 flex gap-[2px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition ${
              i < filled ? TONE_BAR[tone] : 'bg-border'
            }`}
            style={{ opacity: i < filled ? 1 - i * 0.08 : 1 }}
          />
        ))}
      </div>
    </div>
  );
}
