import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Briefcase,
  CalendarClock,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { NewClientDialog } from '@/components/client/NewClientDialog';
import { BRAND } from '@/lib/brand';
import type { PortfolioKPIs } from '@/lib/portfolio-stats';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Up late';
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function PortfolioHeader({ kpis }: { kpis: PortfolioKPIs }) {
  const tiles: TileProps[] = [
    {
      label: 'Active clients',
      value: kpis.totalClients,
      icon: <Briefcase className="h-3.5 w-3.5" />,
      tone: 'default',
    },
    {
      label: 'Open concerns',
      value: kpis.totalOpenConcerns,
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      tone: kpis.totalOpenConcerns > 0 ? 'yellow' : 'default',
    },
    {
      label: 'We owe',
      value: kpis.totalWeOwe,
      icon: <ArrowUpFromLine className="h-3.5 w-3.5" />,
      tone: kpis.totalWeOwe > 0 ? 'blue' : 'default',
      hint: 'pending deliverables',
    },
    {
      label: 'They owe',
      value: kpis.totalTheyOwe,
      icon: <ArrowDownToLine className="h-3.5 w-3.5" />,
      tone: kpis.totalTheyOwe > 0 ? 'blue' : 'default',
      hint: 'awaiting client',
    },
    {
      label: 'Wins logged',
      value: kpis.totalWins,
      icon: <Trophy className="h-3.5 w-3.5" />,
      tone: kpis.totalWins > 0 ? 'green' : 'default',
    },
    {
      label: 'Stale clients',
      value: kpis.staleClients,
      icon: <CalendarClock className="h-3.5 w-3.5" />,
      tone: kpis.staleClients > 0 ? 'red' : 'default',
      hint: '14+ days no call',
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-spotlight animate-rise">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dot-grid opacity-50" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-2.5 px-3 pb-3 pt-3 sm:gap-3 sm:px-5 sm:pb-5 sm:pt-4 lg:flex-row lg:items-end lg:justify-between lg:gap-4 lg:px-7 lg:pb-5 lg:pt-6 2xl:gap-6 2xl:px-8 2xl:pb-7 2xl:pt-8 min-[1920px]:gap-7 min-[1920px]:px-10 min-[1920px]:pb-8 min-[1920px]:pt-10">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-text-muted sm:gap-x-2 sm:text-[10.5px] 2xl:text-[10.5px]">
            <Sparkles className="h-2.5 w-2.5 shrink-0 text-accent sm:h-3 sm:w-3 min-[1920px]:h-3.5 min-[1920px]:w-3.5" />
            <span>{BRAND.tagline}</span>
            <span className="text-text-muted/40">·</span>
            <span>{todayLabel()}</span>
          </div>
          <h1 className="mt-1.5 text-[1.125rem] font-semibold leading-tight tracking-tight text-text sm:mt-2 sm:text-[1.625rem] lg:text-[1.75rem] 2xl:text-[28px] min-[1920px]:mt-2.5 min-[1920px]:text-[32px]">
            {greeting()}.
            <span className="ml-1 bg-gradient-to-r from-text-muted via-text-dim to-text-muted bg-clip-text text-transparent sm:ml-1.5 2xl:ml-2">
              Here&rsquo;s your portfolio.
            </span>
          </h1>
          <p className="mt-1.5 hidden max-w-xl text-[12px] leading-snug text-text-muted lg:mt-2 lg:block lg:text-[13px] 2xl:leading-relaxed min-[1920px]:text-[14px]">
            Every active client at a glance. Click any project for the full brain, or use{' '}
            <span className="rounded bg-accent-soft px-1 py-0.5 font-medium text-text">Get Briefed</span>{' '}
            for an AI summary you can paste straight into Slack.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NewClientDialog />
        </div>
      </div>

      <div className="relative grid grid-cols-2 gap-px border-t border-border bg-border/50 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(t => (
          <Tile key={t.label} {...t} />
        ))}
      </div>
    </section>
  );
}

type Tone = 'default' | 'red' | 'yellow' | 'blue' | 'green';
type TileProps = {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  hint?: string;
  tone?: Tone;
};

const TONE_TEXT: Record<Tone, string> = {
  default: 'text-text',
  red: 'text-status-red',
  yellow: 'text-status-yellow',
  blue: 'text-status-blue',
  green: 'text-status-green',
};

const TONE_BAR: Record<Tone, string> = {
  default: 'bg-border-strong',
  red: 'bg-gradient-to-r from-status-red/0 via-status-red to-status-red/0',
  yellow: 'bg-gradient-to-r from-status-yellow/0 via-status-yellow to-status-yellow/0',
  blue: 'bg-gradient-to-r from-status-blue/0 via-status-blue to-status-blue/0',
  green: 'bg-gradient-to-r from-status-green/0 via-status-green to-status-green/0',
};

function Tile({ label, value, icon, hint, tone = 'default' }: TileProps) {
  const active = tone !== 'default';
  return (
    <div className="group relative overflow-hidden bg-surface/80 px-2.5 py-2 transition hover:bg-surface-2 sm:px-4 sm:py-3 2xl:px-5 2xl:py-4">
      {active && (
        <span
          aria-hidden
          className={`absolute inset-x-0 top-0 h-px opacity-80 ${TONE_BAR[tone]}`}
        />
      )}
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted sm:gap-1.5 sm:text-[10px] 2xl:gap-1.5 2xl:text-[10px]">
        <span className={TONE_TEXT[tone]}>{icon}</span>
        <span>{label}</span>
      </div>
      <div
        className={`stat-num mt-1 text-[1.125rem] font-semibold leading-none tracking-tight sm:mt-1.5 sm:text-[1.625rem] 2xl:mt-2 2xl:text-[26px] min-[1920px]:text-[28px] ${TONE_TEXT[tone]}`}>
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-[9px] text-text-muted sm:mt-1 sm:text-[10px] 2xl:mt-1.5 2xl:text-[11px]">{hint}</div>
      )}
    </div>
  );
}
