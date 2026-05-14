import { ClientList } from '@/components/client/ClientList';
import { PortfolioHeader } from '@/components/dashboard/PortfolioHeader';
import { PortfolioPulse } from '@/components/dashboard/PortfolioPulse';
import { HealthRing } from '@/components/dashboard/HealthRing';
import { NeedsAttention } from '@/components/dashboard/NeedsAttention';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { getPortfolioData } from '@/lib/db/queries';
import {
  computePortfolioKPIs,
  computeHealthDistribution,
  computeAttentionItems,
} from '@/lib/portfolio-stats';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // TEMP DEBUG — confirm which DB the running server is reading.
  // Remove once cache issue is diagnosed.
  console.log('[DASHBOARD] DB URL =', process.env.TURSO_DATABASE_URL);

  const { items, recentActivity, portfolioCadence } = await getPortfolioData();

  console.log('[DASHBOARD] live counts —', {
    clients: items.length,
    callsAcrossAllClients: items.reduce((a, i) => a + i.stats.callCount, 0),
    openConcernsAcrossAllClients: items.reduce((a, i) => a + i.stats.openConcerns, 0),
    winsAcrossAllClients: items.reduce((a, i) => a + (i.brain.wins?.length ?? 0), 0),
  });

  const kpis = computePortfolioKPIs(items);
  const distribution = computeHealthDistribution(items);
  const attention = computeAttentionItems(items, 6);

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100svh-6rem-1px)] lg:gap-3 lg:overflow-hidden">
      <div className="shrink-0">
        <PortfolioHeader kpis={kpis} />
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-3">
        <div className="lg:col-span-8">
          <PortfolioPulse buckets={portfolioCadence} />
        </div>
        <div className="lg:col-span-4">
          <HealthRing dist={distribution} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:gap-3">
        <section className="lg:col-span-8 lg:h-full lg:min-h-0">
          <ClientList items={items} />
        </section>
        <aside className="flex flex-col gap-3 lg:col-span-4 lg:h-full lg:min-h-0 lg:overflow-hidden">
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
