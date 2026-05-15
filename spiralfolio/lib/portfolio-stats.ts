import type { Client } from '@/lib/db/schema';
import type { ClientBrain } from '@/lib/db/brain';
import type { BrainStats } from '@/lib/brain-stats';
import { sessionDateAgeDays } from '@/lib/utils';

export type ClientWithBrain = { client: Client; brain: ClientBrain; stats: BrainStats };

export type PortfolioKPIs = {
  totalClients: number;
  totalOpenConcerns: number;
  totalWeOwe: number;
  totalTheyOwe: number;
  totalWins: number;
  totalCalls: number;
  staleClients: number;
};

export type HealthDistribution = {
  'on-track': number;
  'at-risk': number;
  blocked: number;
  complete: number;
  total: number;
};

export type AttentionItem = {
  kind: 'blocked-client' | 'at-risk-client' | 'blocking-concern' | 'stale-client';
  severity: 1 | 2 | 3;
  clientId: string;
  clientName: string;
  engagement: string | null;
  detail: string;
  meta?: string;
};

export type RecentActivityItem = {
  callId: string;
  clientId: string;
  clientName: string;
  callDate: string;
  callType: string | null;
  callSummary: string | null;
};

const STALE_DAYS = 14;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function isStale(stats: BrainStats): boolean {
  const d = daysSince(stats.lastCallDate);
  return d !== null && d > STALE_DAYS;
}

export function staleness(stats: BrainStats): {
  days: number | null;
  level: 'fresh' | 'stale' | 'very-stale';
} {
  const d = daysSince(stats.lastCallDate);
  if (d === null) return { days: null, level: 'fresh' };
  if (d > 30) return { days: d, level: 'very-stale' };
  if (d > STALE_DAYS) return { days: d, level: 'stale' };
  return { days: d, level: 'fresh' };
}

export function computePortfolioKPIs(items: ClientWithBrain[]): PortfolioKPIs {
  let openConcerns = 0;
  let weOwe = 0;
  let theyOwe = 0;
  let totalWins = 0;
  let calls = 0;
  let stale = 0;
  for (const it of items) {
    openConcerns += it.stats.openConcerns;
    weOwe += it.stats.ourPending;
    theyOwe += it.stats.theirPending;
    totalWins += it.brain.wins?.length ?? 0;
    calls += it.stats.callCount;
    if (isStale(it.stats)) stale++;
  }
  return {
    totalClients: items.length,
    totalOpenConcerns: openConcerns,
    totalWeOwe: weOwe,
    totalTheyOwe: theyOwe,
    totalWins,
    totalCalls: calls,
    staleClients: stale,
  };
}

export function computeHealthDistribution(items: ClientWithBrain[]): HealthDistribution {
  const dist: HealthDistribution = {
    'on-track': 0,
    'at-risk': 0,
    blocked: 0,
    complete: 0,
    total: items.length,
  };
  for (const { client } of items) {
    const s = (client.status ?? 'on-track') as keyof HealthDistribution;
    if (s in dist && s !== 'total') (dist[s] as number)++;
  }
  return dist;
}

export function computeAttentionItems(items: ClientWithBrain[], limit = 6): AttentionItem[] {
  const out: AttentionItem[] = [];

  for (const { client, brain, stats } of items) {
    if (client.status === 'blocked') {
      out.push({
        kind: 'blocked-client',
        severity: 1,
        clientId: client.id,
        clientName: client.name,
        engagement: client.engagement ?? null,
        detail: 'Client marked blocked',
        meta:
          stats.openConcerns > 0
            ? `${stats.openConcerns} open concern${stats.openConcerns === 1 ? '' : 's'}`
            : undefined,
      });
    } else if (client.status === 'at-risk') {
      out.push({
        kind: 'at-risk-client',
        severity: 2,
        clientId: client.id,
        clientName: client.name,
        engagement: client.engagement ?? null,
        detail: 'Client marked at-risk',
        meta:
          stats.openConcerns > 0
            ? `${stats.openConcerns} open concern${stats.openConcerns === 1 ? '' : 's'}`
            : undefined,
      });
    }

    for (const c of brain.open_concerns ?? []) {
      if (c.blocker_for) {
        out.push({
          kind: 'blocking-concern',
          severity: client.status === 'blocked' ? 1 : 2,
          clientId: client.id,
          clientName: client.name,
          engagement: client.engagement ?? null,
          detail: c.concern,
          meta: `Blocking ${c.blocker_for}${c.owner ? ` · ${c.owner}` : ''}`,
        });
      }
    }

    const s = staleness(stats);
    if (s.level !== 'fresh' && client.status !== 'complete') {
      out.push({
        kind: 'stale-client',
        severity: s.level === 'very-stale' ? 2 : 3,
        clientId: client.id,
        clientName: client.name,
        engagement: client.engagement ?? null,
        detail: s.days !== null ? `No call in ${s.days} days` : 'No calls yet',
      });
    }
  }

  out.sort((a, b) => a.severity - b.severity);
  return out.slice(0, limit);
}

/** 12-bucket call-cadence series ending today (one bucket per ~7 days). */
export function buildCallCadence(brain: ClientBrain, buckets = 12, bucketDays = 7): number[] {
  const out = new Array<number>(buckets).fill(0);
  for (const entry of brain.call_log ?? []) {
    const ageDays = sessionDateAgeDays(entry.date);
    if (ageDays === null || ageDays < 0) continue;
    const idxFromEnd = Math.floor(ageDays / bucketDays);
    if (idxFromEnd < 0 || idxFromEnd >= buckets) continue;
    out[buckets - 1 - idxFromEnd]++;
  }
  return out;
}
