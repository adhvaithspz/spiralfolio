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
    <section className="overflow-hidden rounded-2xl border border-border surface-glass p-2.5 sm:p-4 2xl:p-5 min-[1920px]:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2 min-[1920px]:gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-status-green/10 text-status-green sm:h-7 sm:w-7 sm:rounded-lg min-[1920px]:h-8 min-[1920px]:w-8">
            <Heart className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          </span>
          <div>
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-dim sm:text-[11.5px] min-[1920px]:text-[12px]">
              Portfolio Health
            </h3>
            <p className="mt-0 text-[10px] text-text-muted sm:mt-0.5 sm:text-[11px] min-[1920px]:text-[12px]">
              {dist.total} active engagement{dist.total === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-col items-center gap-3 sm:mt-3 sm:flex-row sm:items-center sm:gap-5 2xl:mt-5 2xl:gap-6 min-[1920px]:gap-7">
        <div className="relative h-[100px] w-[100px] shrink-0 sm:h-[128px] sm:w-[128px] 2xl:h-[150px] 2xl:w-[150px]">
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
            <span className="stat-num text-[18px] font-semibold leading-none text-status-green sm:text-[24px] 2xl:text-[26px] min-[1920px]:text-[28px]">
              {onTrackPct}%
            </span>
            <span className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.14em] text-text-muted sm:text-[10px] min-[1920px]:text-[11px]">
              healthy
            </span>
          </div>
        </div>

        <ul className="w-full min-w-0 flex-1 space-y-1 sm:space-y-1.5 2xl:space-y-2">
          {SEGMENTS.map(s => {
            const count = dist[s.key];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <li key={s.key} className="group">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-[10px] text-text-dim sm:gap-2 sm:text-[12px] min-[1920px]:text-[13px]">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2 min-[1920px]:h-2.5 min-[1920px]:w-2.5 ${s.bg}`} />
                    {s.label}
                  </span>
                  <span className="stat-num text-[11px] sm:text-[12px] min-[1920px]:text-[13px]">
                    <span className={s.text}>{count}</span>
                    <span className="ml-1 text-[9px] text-text-muted sm:ml-1.5 sm:text-[10px] min-[1920px]:text-[11px]">
                      {pct}%
                    </span>
                  </span>
                </div>
                <div className="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-bg ring-soft sm:mt-1 sm:h-1 min-[1920px]:h-1">
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
