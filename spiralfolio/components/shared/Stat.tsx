import { cn } from '@/lib/utils';

export function Stat({
  label,
  value,
  hint,
  accent,
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: 'default' | 'red' | 'yellow' | 'green' | 'blue';
  className?: string;
}) {
  const accentColor =
    accent === 'red'
      ? 'text-status-red'
      : accent === 'yellow'
        ? 'text-status-yellow'
        : accent === 'green'
          ? 'text-status-green'
          : accent === 'blue'
            ? 'text-status-blue'
            : 'text-text';
  return (
    <div className={cn('rounded-md border border-border bg-surface px-3 py-2.5', className)}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</div>
      <div className={cn('stat-num mt-1 text-xl font-semibold leading-none', accentColor)}>{value}</div>
      {hint && <div className="mt-1 text-[11px] text-text-muted">{hint}</div>}
    </div>
  );
}
