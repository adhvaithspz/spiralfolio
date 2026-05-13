import { ClientList } from '@/components/client/ClientList';
import { NewClientDialog } from '@/components/client/NewClientDialog';
import { BRAND } from '@/lib/brand';
import { getDashboardData } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const items = await getDashboardData();

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{BRAND.name}</h1>
          <p className="mt-0.5 text-[12px] text-text-muted">{today} · {items.length} active client{items.length === 1 ? '' : 's'}</p>
        </div>
        <NewClientDialog />
      </div>

      <ClientList items={items} />
    </div>
  );
}
