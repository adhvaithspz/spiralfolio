import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Big visual: weekly call volume across the entire portfolio for the past N
 * weeks. Renders as a real SVG bar chart with a hover lane and trend pill.
 */
export function PortfolioPulse({
  buckets,
  weeksLabel = 'Last 16 weeks',
}: {
  buckets: number[];
  weeksLabel?: string;
}) {
  const total = buckets.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...buckets);
  const peakIdx = buckets.indexOf(max);
  const recentHalf = buckets.slice(Math.floor(buckets.length / 2)).reduce((a, b) => a + b, 0);
  const olderHalf = buckets.slice(0, Math.floor(buckets.length / 2)).reduce((a, b) => a + b, 0);
  const trend: 'up' | 'down' | 'flat' =
    recentHalf > olderHalf ? 'up' : recentHalf < olderHalf ? 'down' : 'flat';
  const trendDelta =
    olderHalf === 0
      ? recentHalf > 0
        ? 100
        : 0
      : Math.round(((recentHalf - olderHalf) / olderHalf) * 100);

  const W = 800;
  const H = 120;
  const PAD_X = 8;
  const PAD_Y = 12;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const gap = 4;
  const barW = (innerW - gap * (buckets.length - 1)) / buckets.length;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border surface-glass p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Activity className="h-3.5 w-3.5" />
          </span>
          <div>
            <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-text-dim">
              Portfolio Pulse
            </h2>
            <p className="mt-0.5 text-[11px] text-text-muted">{weeksLabel} of call activity</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Pill
            label={`${total}`}
            sub="calls"
          />
          <Pill
            label={`${max}`}
            sub={`peak wk ${buckets.length - peakIdx}`}
            tone={max > 0 ? 'accent' : 'default'}
          />
          <TrendPill trend={trend} delta={trendDelta} />
        </div>
      </div>

      <div className="mt-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-[120px] w-full"
          role="img"
          aria-label="Weekly call volume">
          <defs>
            <linearGradient id="pp-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818bff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.45" />
            </linearGradient>
            <linearGradient id="pp-bar-latest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a5b4fc" stopOpacity="1" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.7" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map(t => (
            <line
              key={t}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={PAD_Y + innerH * t}
              y2={PAD_Y + innerH * t}
              stroke="#26262c"
              strokeDasharray="2 4"
            />
          ))}

          {buckets.map((count, i) => {
            const h = count === 0 ? 2 : Math.max(3, (count / max) * innerH);
            const x = PAD_X + i * (barW + gap);
            const y = PAD_Y + innerH - h;
            const isLatest = i === buckets.length - 1;
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={PAD_Y}
                  width={barW}
                  height={innerH}
                  fill="transparent"
                  className="hover:fill-white/[0.03]"
                />
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={Math.min(2, barW / 3)}
                  fill={count === 0 ? '#26262c' : isLatest ? 'url(#pp-bar-latest)' : 'url(#pp-bar)'}
                />
                {isLatest && count > 0 && (
                  <circle cx={x + barW / 2} cy={y} r={2.5} fill="#a5b4fc" />
                )}
              </g>
            );
          })}
        </svg>
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.14em] text-text-muted/70">
          <span>{buckets.length}w ago</span>
          <span>this week</span>
        </div>
      </div>
    </section>
  );
}

function Pill({
  label,
  sub,
  tone = 'default',
}: {
  label: string;
  sub: string;
  tone?: 'default' | 'accent';
}) {
  const text = tone === 'accent' ? 'text-accent' : 'text-text';
  return (
    <div className="flex items-baseline gap-1.5 rounded-lg border border-border bg-surface/50 px-2.5 py-1.5">
      <span className={`stat-num text-[15px] font-semibold ${text}`}>{label}</span>
      <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{sub}</span>
    </div>
  );
}

function TrendPill({ trend, delta }: { trend: 'up' | 'down' | 'flat'; delta: number }) {
  const cfg = {
    up: {
      icon: <TrendingUp className="h-3 w-3" />,
      tone: 'border-status-green/30 bg-status-green/10 text-status-green',
      label: `+${delta}%`,
    },
    down: {
      icon: <TrendingDown className="h-3 w-3" />,
      tone: 'border-status-red/30 bg-status-red/10 text-status-red',
      label: `${delta}%`,
    },
    flat: {
      icon: <Minus className="h-3 w-3" />,
      tone: 'border-border bg-surface text-text-muted',
      label: 'flat',
    },
  }[trend];
  return (
    <div
      className={`stat-num flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium ${cfg.tone}`}>
      {cfg.icon}
      <span>{cfg.label}</span>
    </div>
  );
}
