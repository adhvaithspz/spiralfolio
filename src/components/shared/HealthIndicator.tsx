import { cn } from '@/lib/utils';

const COLORS: Record<string, { dot: string; halo: string }> = {
  'on-track': { dot: 'bg-status-green', halo: 'shadow-[0_0_0_3px_rgba(34,197,94,0.18)]' },
  'at-risk': { dot: 'bg-status-yellow', halo: 'shadow-[0_0_0_3px_rgba(234,179,8,0.22)]' },
  blocked: { dot: 'bg-status-red', halo: 'shadow-[0_0_0_3px_rgba(239,68,68,0.24)]' },
  complete: { dot: 'bg-status-grey', halo: 'shadow-[0_0_0_3px_rgba(113,113,122,0.16)]' },
};

export function HealthIndicator({
  status,
  className,
  size = 'md',
}: {
  status: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const { dot, halo } = COLORS[status] ?? COLORS.complete;
  const pulse = status === 'at-risk' || status === 'blocked';
  const dim =
    size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-2.5 w-2.5' : 'h-2 w-2';
  return (
    <span
      aria-label={status}
      title={status}
      className={cn(
        'inline-block rounded-full',
        dim,
        dot,
        halo,
        pulse && 'animate-status-pulse',
        className,
      )}
    />
  );
}
