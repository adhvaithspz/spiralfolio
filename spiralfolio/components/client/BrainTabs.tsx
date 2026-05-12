'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export type BrainTabKey = 'overview' | 'deliverables' | 'contacts' | 'calls' | 'icp' | 'documents';

const TABS: { key: BrainTabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'calls', label: 'Call Log' },
  { key: 'icp', label: 'ICP Profile' },
  { key: 'documents', label: 'Documents' },
];

export function BrainTabs({
  defaultTab = 'overview',
  panels,
}: {
  defaultTab?: BrainTabKey;
  panels: Record<BrainTabKey, React.ReactNode>;
}) {
  return (
    <Tabs.Root defaultValue={defaultTab} className="space-y-4">
      <Tabs.List className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <Tabs.Trigger
            key={t.key}
            value={t.key}
            className={cn(
              'relative px-3 py-2 text-[12px] font-medium uppercase tracking-wider text-text-muted hover:text-text',
              'data-[state=active]:text-text data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-px data-[state=active]:after:bg-accent'
            )}>
            {t.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {TABS.map(t => (
        <Tabs.Content key={t.key} value={t.key} className="focus:outline-none">
          {panels[t.key]}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
