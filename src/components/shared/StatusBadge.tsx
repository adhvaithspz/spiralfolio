
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/shared/Tooltip';

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

/** Short explanations shown on hover for known workflow / cadence pills. */
const DEFAULT_HINTS: Record<string, string> = {
  'on-track':
    'Overall health: no critical blockers recorded in the brain; engagement moving forward as expected.',
  'at-risk':
    'Elevated risk: open concerns, slipping commitments, or friction worth reviewing before the next touchpoint.',
  blocked: 'Work is stopped until a dependency, decision, or external issue is cleared.',
  complete: 'This initiative or phase is finished from a tracking perspective.',
  'in-progress': 'Actively being executed by the team; updates should appear as calls are processed.',
  pending: 'Captured on the board but not started or waiting on someone else.',
  done: 'Deliverable is complete and no longer on the active list.',
  open: 'Concern is still active and needs a decision, owner action, or resolution.',
  resolved: 'This concern was cleared or is no longer applicable.',
  weekly: 'This entry is from a recurring weekly client call.',
  kickoff: 'Initial or kickoff-style call with the client.',
  checkin: 'Check-in or status call (non-weekly cadence).',
  'qbr': 'Quarterly business review or similar executive readout.',
};

export function StatusBadge({
  status,
  className,
  size = 'sm',
  tooltip,
}: {
  status: Status;
  className?: string;
  size?: 'sm' | 'xs';
  /** Pass `false` to disable the default tooltip. */
  tooltip?: string | false;
}) {
  const key = String(status ?? '').toLowerCase();
  const style = STYLES[key] ?? 'bg-surface-2 text-text-dim border-border';
  const label = key.replace(/-/g, ' ');
  const hint =
    tooltip === false
      ? null
      : (tooltip ??
        DEFAULT_HINTS[key] ??
        `Label for this item’s current state in SpiralFolio: ${label}.`);

  const badge = (
    <span
      className={cn(
        'inline-flex cursor-help items-center rounded-full border font-mono uppercase tracking-wider',
        size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]',
        style,
        className,
      )}>
      {label}
    </span>
  );

  if (!hint) return badge;
  return <Tooltip content={hint}>{badge}</Tooltip>;
}
