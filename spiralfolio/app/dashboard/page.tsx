import { ClientList } from '@/components/client/ClientList';
import { NewClientDialog } from '@/components/client/NewClientDialog';
import { BRAND } from '@/lib/brand';
import { computeBrainStats } from '@/lib/brain-stats';
import { getClientBrain, listClients } from '@/lib/db/queries';
import type { BrainStats } from '@/lib/brain-stats';
import type { Client } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const clients = listClients();

  const items: { client: Client; stats: BrainStats }[] = clients.map(client => {
    const brain = getClientBrain(client.id);
    return { client, stats: computeBrainStats(brain) };
  });

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
          <p className="mt-0.5 text-[12px] text-text-muted">{today} · {clients.length} active client{clients.length === 1 ? '' : 's'}</p>
        </div>
        <NewClientDialog />
      </div>

      <ClientList items={items} />
    </div>
  );
}
