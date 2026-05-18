import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import type { Client } from '@/lib/types/schema';
import type { ClientBrain } from '@/lib/types/brain';
import { DocumentsPanel } from '@/components/client/DocumentsPanel';
import { apiFetch } from '@/lib/api';

export function DocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [brain, setBrain] = useState<ClientBrain | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const res = await apiFetch(`/api/clients/${encodeURIComponent(id)}`);
      if (cancelled) return;
      if (res.status === 404) {
        setClient(null);
        setBrain(null);
        return;
      }
      const data = (await res.json()) as { client: Client; brain: ClientBrain };
      setClient(data.client);
      setBrain(data.brain);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id || client === undefined) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-[13px] text-text-muted">Loading…</div>
    );
  }
  if (!client || !brain) {
    return <div className="py-16 text-center text-[13px] text-text-muted">Client not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/clients/${client.id}`}
          className="inline-flex items-center gap-1 text-[12px] text-text-muted hover:text-text">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to client
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{client.name} — Documents</h1>
      </div>
      <DocumentsPanel
        clientId={client.id}
        initialFolderUrl={client.driveFolderUrl}
        documents={brain.documents ?? []}
      />
    </div>
  );
}
