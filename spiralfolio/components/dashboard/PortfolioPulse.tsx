'use client';

import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Tooltip } from '@/components/shared/Tooltip';
import type { PortfolioPulseBucket, PortfolioPulseBucketCall } from '@/lib/portfolio-pulse';
import { useMinWidth } from '@/lib/hooks/use-min-width';
import { cn, formatSessionDate } from '@/lib/utils';

/**
 * Big visual: weekly call volume across the entire portfolio for the past N
 * weeks. Renders as a real SVG bar chart with a hover lane and trend pill.
 */
export function PortfolioPulse({
  buckets,
  weeksLabel = 'Last 16 weeks',
}: {
  buckets: PortfolioPulseBucket[];
  weeksLabel?: string;
}) {
  const counts = buckets.map(b => b.count);
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  const peakIdx = counts.indexOf(max);
  const recentHalf = buckets.slice(Math.floor(buckets.length / 2)).reduce((a, b) => a + b.count, 0);
  const olderHalf = buckets.slice(0, Math.floor(buckets.length / 2)).reduce((a, b) => a + b.count, 0);
  const trend: 'up' | 'down' | 'flat' =
    recentHalf > olderHalf ? 'up' : recentHalf < olderHalf ? 'down' : 'flat';
  const trendDelta =
    olderHalf === 0
      ? recentHalf > 0
        ? 100
        : 0
      : Math.round(((recentHalf - olderHalf) / olderHalf) * 100);

  /** Large desktops / 4K-style widths: restore the original taller chart math. */
  const largeChart = useMinWidth('(min-width: 1536px)');

  const W = 800;
  const H = largeChart ? 120 : 96;
  const PAD_X = 8;
  const PAD_Y = largeChart ? 12 : 8;
  const innerH = H - PAD_Y * 2;

  /** Bar lane height — must match chart wrapper height minus vertical padding on the flex row. */
  const chartBodyPx = H - PAD_Y * 2;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border surface-glass p-2.5 sm:p-4 2xl:p-5 min-[1920px]:p-6">
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 2xl:gap-3">
        <Tooltip
          content={
            <>
              <span className="font-medium text-text">How to read this</span>
              <p className="mt-1.5 text-text-muted">
                Each bar is one 7-day bucket across <em className="not-italic text-text">all clients</em>,
                counting every logged call in your database. Hover a bar for the exact date range and
                which calls fell in that week.
              </p>
            </>
          }
        >
          <div className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/40 sm:gap-2.5 2xl:gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent sm:h-7 sm:w-7 sm:rounded-lg min-[1920px]:h-8 min-[1920px]:w-8">
              <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </span>
            <div className="text-left">
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-text-dim sm:text-[11.5px] min-[1920px]:text-[12px]">
                Portfolio Pulse
              </h2>
              <p className="mt-0 hidden text-[10px] text-text-muted sm:mt-0.5 sm:block sm:text-[11px] min-[1920px]:text-[12px]">
                {weeksLabel} of call activity
              </p>
            </div>
          </div>
        </Tooltip>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 2xl:gap-3">
          <Tooltip
            content={`Sum of all calls in the last ${buckets.length} weekly buckets (${total} total).`}
          >
            <span className="inline-flex">
              <Pill
                label={`${total}`}
                sub="calls"
              />
            </span>
          </Tooltip>
          <Tooltip
            content={
              max === 0 ? (
                'No calls in this window yet.'
              ) : (
                <>
                  Highest-volume week in the chart. &ldquo;Wk&nbsp;1&rdquo; is this week;
                  higher numbers count backward (larger = further in the past).
                </>
              )
            }
          >
            <span className="inline-flex">
              <Pill
                label={`${max}`}
                sub={`peak wk ${buckets.length - peakIdx}`}
                tone={max > 0 ? 'accent' : 'default'}
              />
            </span>
          </Tooltip>
          <Tooltip
            content={
              olderHalf === 0 && recentHalf > 0
                ? 'No calls in the older half of this window, so the recent stretch defines the trend.'
                : 'Compares total calls in the newer half of this window vs. the older half (same number of weeks each).'
            }
          >
            <span className="inline-flex">
              <TrendPill trend={trend} delta={trendDelta} />
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="mt-2 sm:mt-3 2xl:mt-5">
        <div
          className={cn(
            'relative w-full px-1 sm:px-2',
            largeChart ? 'h-[120px]' : 'h-[96px]',
          )}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden>
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
          </svg>

          <div
            className={cn(
              'relative flex h-full gap-0.5 sm:gap-1',
              largeChart ? 'py-3' : 'py-2',
            )}
            role="img"
            aria-label="Weekly call volume">
            {buckets.map((bucket, i) => {
              const isLatest = i === buckets.length - 1;
              const hPx =
                bucket.count === 0 ? 2 : Math.max(3, (bucket.count / max) * chartBodyPx);
              return (
                <Tooltip
                  key={i}
                  side="top"
                  content={<BarTooltipContent bucket={bucket} />}
                >
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-end">
                    <div
                      className="relative w-full"
                      style={{ height: hPx }}>
                      {isLatest && bucket.count > 0 ? (
                        <span
                          className="absolute -top-1 left-1/2 z-[1] block h-2 w-2 -translate-x-1/2 rounded-full bg-[#a5b4fc]"
                          aria-hidden
                        />
                      ) : null}
                      <div
                        className={cn(
                          'h-full w-full rounded-sm',
                          bucket.count === 0
                            ? 'bg-[#26262c]'
                            : isLatest
                              ? 'bg-gradient-to-b from-[#a5b4fc] to-[#6366f1]/70'
                              : 'bg-gradient-to-b from-[#818bff] to-[#6366f1]/45',
                          bucket.count > 0 && 'opacity-95',
                        )}
                      />
                    </div>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>
        <div className="mt-1 flex justify-between text-[9px] uppercase tracking-[0.14em] text-text-muted/70 sm:mt-2 sm:text-[10px] 2xl:text-[11px]">
          <Tooltip content="Oldest week shown (first bar on the left).">
            <span>{buckets.length}w ago</span>
          </Tooltip>
          <Tooltip content="Most recent 7-day bucket (rightmost bar).">
            <span>this week</span>
          </Tooltip>
        </div>
      </div>
    </section>
  );
}

function callTitle(c: PortfolioPulseBucketCall): string {
  const raw = c.callType?.trim();
  if (!raw) return c.clientName;
  const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return `${c.clientName} — ${label}`;
}

function BarTooltipContent({ bucket }: { bucket: PortfolioPulseBucket }) {
  return (
    <div className="space-y-2 text-left">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Time range</p>
        <p className="text-[12px] font-medium text-text">{bucket.rangeLabel}</p>
      </div>
      <p className="text-[11px] text-text-muted">
        {bucket.count === 0
          ? '0 calls across all clients.'
          : `${bucket.count} call${bucket.count === 1 ? '' : 's'} across all clients.`}
      </p>
      {bucket.calls.length > 0 ? (
        <div className="border-t border-border-strong pt-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
            Calls in this week
          </p>
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-0.5">
            {bucket.calls.map((c, idx) => (
              <li
                key={`${c.clientName}-${c.callDate}-${idx}`}
                className="text-[10.5px] leading-snug text-text">
                <span className="font-medium">{callTitle(c)}</span>
                <span className="text-text-muted"> · {formatSessionDate(c.callDate)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
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
    <div className="flex items-baseline gap-1 rounded-md border border-border bg-surface/50 px-2 py-1 sm:gap-1.5 sm:rounded-lg sm:px-2.5 sm:py-1.5 min-[1920px]:px-3 min-[1920px]:py-2">
      <span className={`stat-num text-[13px] font-semibold sm:text-[15px] min-[1920px]:text-[16px] ${text}`}>
        {label}
      </span>
      <span className="text-[9px] uppercase tracking-[0.14em] text-text-muted sm:text-[10px] min-[1920px]:text-[11px]">
        {sub}
      </span>
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
      className={`stat-num flex items-center gap-0.5 rounded-md border px-1.5 py-1 text-[10px] font-medium sm:gap-1 sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-[11px] min-[1920px]:text-[12px] ${cfg.tone}`}>
      {cfg.icon}
      <span>{cfg.label}</span>
    </div>
  );
}
