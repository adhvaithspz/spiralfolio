import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  'on-track': 'bg-status-green',
  'at-risk': 'bg-status-yellow',
  blocked: 'bg-status-red',
  complete: 'bg-status-grey',
};

export function HealthIndicator({ status, className }: { status: string; className?: string }) {
  const color = COLORS[status] ?? 'bg-status-grey';
  return (
    <span
      aria-label={status}
      title={status}
      className={cn('inline-block h-2 w-2 rounded-full', color, className)}
    />
  );
}
