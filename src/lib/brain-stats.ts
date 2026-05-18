import type { ClientBrain } from '@/lib/types/brain';

export type BrainStats = {
  goals: number;
  openConcerns: number;
  ourPending: number;
  theirPending: number;
  callCount: number;
  lastCallDate: string | null;
};

const isPending = (status: string | undefined) => (status ?? 'pending').toLowerCase() !== 'done';

export function computeBrainStats(brain: ClientBrain): BrainStats {
  const ours = brain.our_deliverables ?? [];
  const theirs = brain.client_deliverables ?? [];
  const callLog = brain.call_log ?? [];
  return {
    goals: brain.client_goals?.length ?? 0,
    openConcerns: brain.open_concerns?.length ?? 0,
    ourPending: ours.filter(d => isPending(d.status)).length,
    theirPending: theirs.filter(d => isPending(d.status)).length,
    callCount: callLog.length,
    lastCallDate: brain.last_call ?? callLog[0]?.date ?? null,
  };
}
