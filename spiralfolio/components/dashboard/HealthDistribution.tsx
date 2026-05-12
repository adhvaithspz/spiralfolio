import type { HealthDistribution } from '@/lib/portfolio-stats';

const SEGMENTS: {
  key: keyof Omit<HealthDistribution, 'total'>;
  label: string;
  bar: string;
  dot: string;
  text: string;
}[] = [
  { key: 'on-track', label: 'on-track', bar: 'bg-status-green', dot: 'bg-status-green', text: 'text-status-green' },
  { key: 'at-risk', label: 'at-risk', bar: 'bg-status-yellow', dot: 'bg-status-yellow', text: 'text-status-yellow' },
  { key: 'blocked', label: 'blocked', bar: 'bg-status-red', dot: 'bg-status-red', text: 'text-status-red' },
  { key: 'complete', label: 'complete', bar: 'bg-status-grey', dot: 'bg-status-grey', text: 'text-text-muted' },
];

export function HealthDistributionBar({ dist }: { dist: HealthDistribution }) {
  const total = Math.max(dist.total, 1);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Portfolio Health</div>
        <div className="stat-num text-[11px] text-text-muted">
          {dist.total} project{dist.total === 1 ? '' : 's'}
        </div>
      </div>

      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-bg">
        {SEGMENTS.map(s => {
          const count = dist[s.key];
          const pct = (count / total) * 100;
          if (count === 0) return null;
          return (
            <div
              key={s.key}
              className={s.bar}
              style={{ width: `${pct}%` }}
              title={`${count} ${s.label}`}
            />
          );
        })}
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        {SEGMENTS.map(s => {
          const count = dist[s.key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={s.key} className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 text-text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
              <span className="stat-num">
                <span className={s.text}>{count}</span>
                <span className="ml-1 text-text-muted">· {pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
