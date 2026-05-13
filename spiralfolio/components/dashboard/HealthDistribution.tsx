import { Heart } from 'lucide-react';
import type { HealthDistribution } from '@/lib/portfolio-stats';

const SEGMENTS: {
  key: keyof Omit<HealthDistribution, 'total'>;
  label: string;
  bar: string;
  dot: string;
  text: string;
}[] = [
  { key: 'on-track', label: 'On track', bar: 'bg-status-green', dot: 'bg-status-green', text: 'text-status-green' },
  { key: 'at-risk', label: 'At risk', bar: 'bg-status-yellow', dot: 'bg-status-yellow', text: 'text-status-yellow' },
  { key: 'blocked', label: 'Blocked', bar: 'bg-status-red', dot: 'bg-status-red', text: 'text-status-red' },
  { key: 'complete', label: 'Complete', bar: 'bg-status-grey', dot: 'bg-status-grey', text: 'text-text-muted' },
];

export function HealthDistributionBar({ dist }: { dist: HealthDistribution }) {
  const total = Math.max(dist.total, 1);
  const onTrackPct = Math.round((dist['on-track'] / total) * 100);

  return (
    <div className="rounded-xl border border-border surface-glass p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-3.5 w-3.5 text-status-green" />
          <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-text-dim">
            Portfolio Health
          </h3>
        </div>
        <div className="stat-num text-[11px] text-text-muted">
          <span className="text-status-green">{onTrackPct}%</span>
          <span className="ml-1">healthy</span>
        </div>
      </div>

      <div className="relative mt-3.5">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-bg ring-soft">
          {SEGMENTS.map(s => {
            const count = dist[s.key];
            const pct = (count / total) * 100;
            if (count === 0) return null;
            return (
              <div
                key={s.key}
                className={`relative ${s.bar} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${count} ${s.label}`}>
                <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
              </div>
            );
          })}
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {SEGMENTS.map(s => {
          const count = dist[s.key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li
              key={s.key}
              className="flex items-center justify-between rounded-md border border-transparent px-1.5 py-1 transition hover:border-border hover:bg-surface-2">
              <span className="flex items-center gap-2 text-[12px] text-text-dim">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                {s.label}
              </span>
              <span className="stat-num text-[12px]">
                <span className={s.text}>{count}</span>
                <span className="ml-1 text-[10px] text-text-muted">{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
