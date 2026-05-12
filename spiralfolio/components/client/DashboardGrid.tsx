'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ClientCard } from './ClientCard';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Client } from '@/lib/db/schema';
import type { BrainStats } from '@/lib/brain-stats';

type ClientWithStats = { client: Client; stats: BrainStats; cadence: number[] };

const STATUSES = ['all', 'on-track', 'at-risk', 'blocked', 'complete'] as const;

export function DashboardGrid({ items }: { items: ClientWithStats[] }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [pm, setPm] = useState<string>('all');
  const [ad, setAd] = useState<string>('all');

  const pms = useMemo(() => unique(items.map(i => i.client.pmName).filter(Boolean) as string[]), [items]);
  const ads = useMemo(() => unique(items.map(i => i.client.adName).filter(Boolean) as string[]), [items]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return items.filter(({ client }) => {
      if (status !== 'all' && client.status !== status) return false;
      if (pm !== 'all' && client.pmName !== pm) return false;
      if (ad !== 'all' && client.adName !== ad) return false;
      if (!ql) return true;
      return (
        client.name.toLowerCase().includes(ql) ||
        (client.engagement ?? '').toLowerCase().includes(ql) ||
        (client.pmName ?? '').toLowerCase().includes(ql) ||
        (client.adName ?? '').toLowerCase().includes(ql)
      );
    });
  }, [items, q, status, pm, ad]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search clients or engagements…"
            className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>
        <Select
          value={status}
          onChange={v => setStatus(v as (typeof STATUSES)[number])}
          options={STATUSES.map(s => ({ value: s, label: s === 'all' ? 'All statuses' : s }))}
        />
        <Select
          value={pm}
          onChange={setPm}
          options={[{ value: 'all', label: 'All PMs' }, ...pms.map(p => ({ value: p, label: `PM · ${p}` }))]}
        />
        <Select
          value={ad}
          onChange={setAd}
          options={[{ value: 'all', label: 'All ADs' }, ...ads.map(a => ({ value: a, label: `AD · ${a}` }))]}
        />
        <div className="ml-auto text-[11px] text-text-muted">
          Showing <span className="text-text">{filtered.length}</span> of {items.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No clients match these filters." description="Try clearing search or filters." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ client, stats, cadence }) => (
            <ClientCard key={client.id} client={client} stats={stats} cadence={cadence} />
          ))}
        </div>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 rounded-md border border-border bg-surface px-2.5 text-[12px] text-text focus:border-accent focus:outline-none">
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
