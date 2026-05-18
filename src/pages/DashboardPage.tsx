import { useEffect, useState } from 'react';
import { ClientList } from '@/components/client/ClientList';
import { PortfolioHeader } from '@/components/dashboard/PortfolioHeader';
import { PortfolioPulse } from '@/components/dashboard/PortfolioPulse';
import { HealthRing } from '@/components/dashboard/HealthRing';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import {
  computePortfolioKPIs,
  computeHealthDistribution,
  computeAttentionItems,
} from '@/lib/portfolio-stats';
import type { ClientWithBrain } from '@/lib/portfolio-stats';
import { apiFetch } from '@/lib/api';

export function DashboardPage() {
  const [items, setItems] = useState<ClientWithBrain[] | null>(null);
  const [recentActivity, setRecentActivity] = useState<Parameters<typeof RecentActivity>[0]['items']>([]);
  const [portfolioCadence, setPortfolioCadence] =
    useState<Parameters<typeof PortfolioPulse>[0]['buckets']>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await apiFetch('/api/dashboard/portfolio');
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: ClientWithBrain[];
        recentActivity: Parameters<typeof RecentActivity>[0]['items'];
        portfolioCadence: Parameters<typeof PortfolioPulse>[0]['buckets'];
      };
      if (cancelled) return;
      setItems(data.items);
      setRecentActivity(data.recentActivity);
      setPortfolioCadence(data.portfolioCadence);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[13px] text-text-muted">
        Loading portfolio…
      </div>
    );
  }

  const kpis = computePortfolioKPIs(items);
  const distribution = computeHealthDistribution(items);
  const attention = computeAttentionItems(items, 6);

  return (
    <div className="flex flex-col gap-2 sm:gap-3 lg:h-[calc(100svh-6rem-1px)] lg:gap-2 lg:overflow-hidden 2xl:gap-4 min-[1920px]:gap-5">
      <div className="shrink-0">
        <PortfolioHeader kpis={kpis} />
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-12 lg:gap-2 2xl:gap-3 min-[1920px]:gap-4">
        <div className="lg:col-span-8">
          <PortfolioPulse buckets={portfolioCadence} />
        </div>
        <div className="lg:col-span-4">
          <HealthRing dist={distribution} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:gap-2 2xl:gap-3 min-[1920px]:gap-4">
        <section className="lg:col-span-8 lg:h-full lg:min-h-0">
          <ClientList items={items} />
        </section>
        <aside className="flex flex-col gap-2 sm:gap-3 lg:col-span-4 lg:h-full lg:min-h-0 lg:overflow-hidden 2xl:gap-4 min-[1920px]:gap-5">
          <div className="flex min-h-0 flex-1 flex-col">
            <NeedsAttention items={attention} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <RecentActivity items={recentActivity} />
          </div>
        </aside>
      </div>
    </div>
  );
}
