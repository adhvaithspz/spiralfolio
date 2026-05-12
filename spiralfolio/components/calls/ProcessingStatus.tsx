'use client';

import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ProcessingStep = { key: string; label: string };

export function ProcessingStatus({
  steps,
  activeKey,
}: {
  steps: ProcessingStep[];
  activeKey: string;
}) {
  const activeIdx = steps.findIndex(s => s.key === activeKey);
  return (
    <ul className="space-y-2">
      {steps.map((s, i) => {
        const state: 'done' | 'active' | 'pending' =
          i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'pending';
        return (
          <li
            key={s.key}
            className={cn(
              'flex items-center gap-2.5 rounded-md border px-3 py-2 text-[13px]',
              state === 'done' && 'border-status-green/30 bg-status-green/5 text-text',
              state === 'active' && 'border-accent/30 bg-accent/5 text-text',
              state === 'pending' && 'border-border bg-bg text-text-muted'
            )}>
            {state === 'done' && <Check className="h-3.5 w-3.5 text-status-green" />}
            {state === 'active' && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
            {state === 'pending' && <span className="h-3.5 w-3.5 rounded-full border border-border" />}
            <span>{s.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
