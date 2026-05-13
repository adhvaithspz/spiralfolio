import { cn } from '@/lib/utils';

type Accent = 'default' | 'red' | 'yellow' | 'green' | 'blue';

const ACCENT_TEXT: Record<Accent, string> = {
  default: 'text-text',
  red: 'text-status-red',
  yellow: 'text-status-yellow',
  green: 'text-status-green',
  blue: 'text-status-blue',
};

const ACCENT_GLOW: Record<Accent, string> = {
  default: '',
  red: 'before:bg-status-red/40',
  yellow: 'before:bg-status-yellow/40',
  green: 'before:bg-status-green/40',
  blue: 'before:bg-status-blue/40',
};

export function Stat({
  label,
  value,
  hint,
  icon,
  accent = 'default',
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ReactNode;
  accent?: Accent;
  className?: string;
}) {
  const accentText = ACCENT_TEXT[accent];
  const showGlow = accent !== 'default';

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border surface-glass px-3.5 py-3 transition hover:border-border-strong',
        showGlow &&
          'before:absolute before:inset-x-0 before:-top-px before:h-px before:opacity-80',
        showGlow && ACCENT_GLOW[accent],
        className,
      )}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
          {label}
        </div>
        {icon && <span className={cn('text-text-muted', accentText)}>{icon}</span>}
      </div>
      <div className={cn('stat-num mt-2 text-[22px] font-semibold leading-none tracking-tight', accentText)}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11px] text-text-muted">{hint}</div>}
    </div>
  );
}
