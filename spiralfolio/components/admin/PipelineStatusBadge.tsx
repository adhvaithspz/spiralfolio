'use client';

import * as React from 'react';
import { CheckCircle2, Slash, XCircle } from 'lucide-react';
import type { PipelineStatusWord } from '@/lib/admin/pipeline-event-groups';

const CHIP: Record<PipelineStatusWord, { chip: string; icon: React.ReactNode }> = {
  Success: {
    chip: 'border-status-green/30 bg-status-green/10 text-status-green',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  Error: {
    chip: 'border-status-red/30 bg-status-red/10 text-status-red',
    icon: <XCircle className="h-3 w-3" />,
  },
  Skipped: {
    chip: 'border-border bg-surface-2 text-text-muted',
    icon: <Slash className="h-3 w-3" />,
  },
};

/** Left accent rail on grouped rows — keyed like {@link CHIP}. */
export const PIPELINE_STATUS_RAIL: Record<PipelineStatusWord, string> = {
  Success: 'bg-status-green/40',
  Error: 'bg-status-red/50',
  Skipped: 'bg-text-muted/30',
};

export function PipelineStatusBadge({ word }: { word: PipelineStatusWord }) {
  const st = CHIP[word];
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ' +
        st.chip
      }>
      {st.icon}
      {word}
    </span>
  );
}
