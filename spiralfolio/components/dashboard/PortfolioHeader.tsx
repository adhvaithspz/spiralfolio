import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Briefcase, CalendarClock, Flame, Trophy } from 'lucide-react';
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
      icon: <Briefcase className="h-3 w-3" />,
      tone: 'default',
    },
    {
      label: 'Open concerns',
      value: kpis.totalOpenConcerns,
      icon: <AlertTriangle className="h-3 w-3" />,
      tone: kpis.totalOpenConcerns > 0 ? 'yellow' : 'default',
    },
    {
      label: 'We owe',
      value: kpis.totalWeOwe,
      icon: <ArrowUpFromLine className="h-3 w-3" />,
      tone: kpis.totalWeOwe > 0 ? 'blue' : 'default',
      hint: 'pending deliverables',
    },
    {
      label: 'They owe',
      value: kpis.totalTheyOwe,
      icon: <ArrowDownToLine className="h-3 w-3" />,
      tone: kpis.totalTheyOwe > 0 ? 'blue' : 'default',
      hint: 'awaiting client',
    },
    {
      label: 'Wins logged',
      value: kpis.totalWins,
      icon: <Trophy className="h-3 w-3" />,
      tone: kpis.totalWins > 0 ? 'green' : 'default',
    },
    {
      label: 'Stale clients',
      value: kpis.staleClients,
      icon: <CalendarClock className="h-3 w-3" />,
      tone: kpis.staleClients > 0 ? 'red' : 'default',
      hint: '14+ days no call',
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface via-surface to-bg">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />

      <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
            <Flame className="h-3 w-3 text-accent" />
            <span>{BRAND.tagline}</span>
            <span className="text-text-muted/40">·</span>
            <span>{todayLabel()}</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">
            {greeting()}.
            <span className="ml-2 text-text-muted">Here&rsquo;s your portfolio.</span>
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-text-muted">
            Every active client at a glance. Click any project for the full brain, or use{' '}
            <span className="text-text">Get Briefed</span> for an AI summary you can paste straight into Slack.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NewClientDialog />
        </div>
      </div>

      <div className="relative grid grid-cols-2 gap-px border-t border-border bg-border-strong/40 sm:grid-cols-3 lg:grid-cols-6">
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

function Tile({ label, value, icon, hint, tone = 'default' }: TileProps) {
  return (
    <div className="group relative bg-surface px-4 py-3 transition hover:bg-surface-2">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
        <span className={TONE_TEXT[tone]}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`stat-num mt-1.5 text-2xl font-semibold leading-none ${TONE_TEXT[tone]}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-text-muted">{hint}</div>}
    </div>
  );
}
