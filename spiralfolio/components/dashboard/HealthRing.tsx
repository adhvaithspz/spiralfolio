import { Heart } from 'lucide-react';
import type { HealthDistribution } from '@/lib/portfolio-stats';

const SEGMENTS: {
  key: keyof Omit<HealthDistribution, 'total'>;
  label: string;
  color: string;
  text: string;
  bg: string;
}[] = [
  {
    key: 'on-track',
    label: 'On track',
    color: '#22c55e',
    text: 'text-status-green',
    bg: 'bg-status-green',
  },
  {
    key: 'at-risk',
    label: 'At risk',
    color: '#eab308',
    text: 'text-status-yellow',
    bg: 'bg-status-yellow',
  },
  {
    key: 'blocked',
    label: 'Blocked',
    color: '#ef4444',
    text: 'text-status-red',
    bg: 'bg-status-red',
  },
  {
    key: 'complete',
    label: 'Complete',
    color: '#71717a',
    text: 'text-text-muted',
    bg: 'bg-status-grey',
  },
];

/**
 * SVG donut chart for portfolio health. Renders an arc per segment with the
 * dominant "healthy %" callout in the centre, and a labeled legend on the right.
 */
export function HealthRing({ dist }: { dist: HealthDistribution }) {
  const total = Math.max(dist.total, 1);
  const onTrackPct = Math.round((dist['on-track'] / total) * 100);

  const R = 56;
  const STROKE = 14;
  const C = 2 * Math.PI * R;

  let runningOffset = 0;
  const arcs = SEGMENTS.map(s => {
    const v = dist[s.key];
    const frac = v / total;
    const len = frac * C;
    const arc = {
      key: s.key,
      color: s.color,
      dasharray: `${len} ${C - len}`,
      offset: -runningOffset,
    };
    runningOffset += len;
    return arc;
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-border surface-glass p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-green/10 text-status-green">
            <Heart className="h-3.5 w-3.5" />
          </span>
          <div>
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-text-dim">
              Portfolio Health
            </h3>
            <p className="mt-0.5 text-[11px] text-text-muted">
              {dist.total} active engagement{dist.total === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-6">
        <div className="relative h-[150px] w-[150px] shrink-0">
          <svg viewBox="-75 -75 150 150" className="h-full w-full -rotate-90">
            <circle
              cx="0"
              cy="0"
              r={R}
              fill="none"
              stroke="#1c1c22"
              strokeWidth={STROKE}
            />
            {arcs.map(a => (
              <circle
                key={a.key}
                cx="0"
                cy="0"
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={STROKE}
                strokeDasharray={a.dasharray}
                strokeDashoffset={a.offset}
                strokeLinecap="butt"
                className="transition-all duration-500"
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="stat-num text-[28px] font-semibold leading-none text-status-green">
              {onTrackPct}%
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
              healthy
            </span>
          </div>
        </div>

        <ul className="flex-1 space-y-2">
          {SEGMENTS.map(s => {
            const count = dist[s.key];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <li key={s.key} className="group">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 text-[12px] text-text-dim">
                    <span className={`h-2 w-2 rounded-full ${s.bg}`} />
                    {s.label}
                  </span>
                  <span className="stat-num text-[12px]">
                    <span className={s.text}>{count}</span>
                    <span className="ml-1.5 text-[10px] text-text-muted">{pct}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-bg ring-soft">
                  <div
                    className={`h-full ${s.bg} transition-all duration-500`}
                    style={{ width: `${pct}%`, opacity: pct === 0 ? 0 : 1 }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
