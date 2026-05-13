import { ClientList } from '@/components/client/ClientList';
import { PortfolioHeader } from '@/components/dashboard/PortfolioHeader';
import { HealthDistributionBar } from '@/components/dashboard/HealthDistribution';
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
  const { items, recentActivity } = await getPortfolioData();

  const kpis = computePortfolioKPIs(items);
  const distribution = computeHealthDistribution(items);
  const attention = computeAttentionItems(items, 6);

  return (
    <div className="space-y-6">
      <PortfolioHeader kpis={kpis} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <HealthDistributionBar dist={distribution} />
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-text-dim">
                All Clients
              </h2>
              <span className="text-[11px] text-text-muted">{items.length} total</span>
            </div>
            <ClientList items={items} />
          </section>
        </div>
        <aside className="space-y-4 xl:col-span-4">
          <NeedsAttention items={attention} />
          <RecentActivity items={recentActivity} />
        </aside>
      </div>
    </div>
  );
}
