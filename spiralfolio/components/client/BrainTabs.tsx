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
    <Tabs.Root
      defaultValue={defaultTab}
      className="flex min-h-0 flex-1 flex-col gap-1 max-lg:gap-1 sm:gap-3 2xl:gap-4 min-[1920px]:gap-5">
      <Tabs.List className="scrollbar-subtle inline-flex w-full max-w-full shrink-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg border border-border surface-glass p-0.5 sm:gap-1 sm:rounded-xl sm:p-1 2xl:p-1.5 min-[1920px]:rounded-2xl min-[1920px]:p-1.5">
        {TABS.map(t => (
          <Tabs.Trigger
            key={t.key}
            value={t.key}
            className={cn(
              'group relative inline-flex shrink-0 flex-none items-center justify-center gap-0.5 rounded-md px-1.5 py-1 text-[10px] font-medium tracking-wide transition sm:flex-1 sm:gap-1.5 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-[12px] 2xl:px-3.5 2xl:py-2 min-[1920px]:text-[13px]',
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
        <Tabs.Content
          key={t.key}
          value={t.key}
          className="animate-rise flex min-h-0 flex-1 flex-col overflow-hidden outline-none focus:outline-none data-[state=inactive]:hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{panels[t.key]}</div>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
