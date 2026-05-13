'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { LayoutGrid, ListChecks, Users, Phone, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BrainTabKey = 'overview' | 'deliverables' | 'contacts' | 'calls' | 'documents';

const TABS: { key: BrainTabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { key: 'deliverables', label: 'Deliverables', icon: <ListChecks className="h-3.5 w-3.5" /> },
  { key: 'contacts', label: 'Contacts', icon: <Users className="h-3.5 w-3.5" /> },
  { key: 'calls', label: 'Call Log', icon: <Phone className="h-3.5 w-3.5" /> },
  { key: 'documents', label: 'Documents', icon: <FileText className="h-3.5 w-3.5" /> },
];

export function BrainTabs({
  defaultTab = 'overview',
  panels,
}: {
  defaultTab?: BrainTabKey;
  panels: Record<BrainTabKey, React.ReactNode>;
}) {
  return (
    <Tabs.Root defaultValue={defaultTab} className="space-y-5">
      <Tabs.List className="inline-flex w-full items-center gap-1 rounded-xl border border-border surface-glass p-1">
        {TABS.map(t => (
          <Tabs.Trigger
            key={t.key}
            value={t.key}
            className={cn(
              'group relative inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium tracking-wide transition',
              'text-text-muted hover:text-text',
              'data-[state=active]:bg-surface-2 data-[state=active]:text-text data-[state=active]:shadow-[inset_0_0_0_1px_rgba(99,102,241,0.35)]'
            )}>
            <span className="opacity-70 transition group-data-[state=active]:opacity-100 group-data-[state=active]:text-accent">
              {t.icon}
            </span>
            <span>{t.label}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {TABS.map(t => (
        <Tabs.Content key={t.key} value={t.key} className="focus:outline-none animate-rise">
          {panels[t.key]}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
