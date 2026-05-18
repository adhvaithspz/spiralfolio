import type { PipelineStatusWord } from '@/lib/admin/pipeline-event-groups';

export type EventCountSummary = {
  total: number;
  byStatus: Record<PipelineStatusWord, number>;
};
