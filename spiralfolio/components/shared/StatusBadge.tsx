import { cn } from '@/lib/utils';

type Status =
  | 'on-track'
  | 'at-risk'
  | 'blocked'
  | 'complete'
  | 'in-progress'
  | 'pending'
  | 'done'
  | 'open'
  | 'resolved'
  | string;

const STYLES: Record<string, string> = {
  'on-track': 'bg-status-green/10 text-status-green border-status-green/30',
  done: 'bg-status-green/10 text-status-green border-status-green/30',
  resolved: 'bg-status-green/10 text-status-green border-status-green/30',
  'at-risk': 'bg-status-yellow/10 text-status-yellow border-status-yellow/30',
  pending: 'bg-status-yellow/10 text-status-yellow border-status-yellow/30',
  open: 'bg-status-yellow/10 text-status-yellow border-status-yellow/30',
  blocked: 'bg-status-red/10 text-status-red border-status-red/30',
  'in-progress': 'bg-status-blue/10 text-status-blue border-status-blue/30',
  complete: 'bg-status-grey/15 text-text-dim border-border-strong',
};

export function StatusBadge({
  status,
  className,
  size = 'sm',
}: {
  status: Status;
  className?: string;
  size?: 'sm' | 'xs';
}) {
  const key = String(status ?? '').toLowerCase();
  const style = STYLES[key] ?? 'bg-surface-2 text-text-dim border-border';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-mono uppercase tracking-wider',
        size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]',
        style,
        className
      )}>
      {key.replace(/-/g, ' ')}
    </span>
  );
}
