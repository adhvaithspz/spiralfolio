import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import type { Client, Call } from '@/lib/types/schema';
import type { ClientBrain } from '@/lib/types/brain';
import { CallTimeline } from '@/components/client/CallTimeline';
import { TranscriptUploader } from '@/components/calls/TranscriptUploader';
import { apiFetch } from '@/lib/api';

export function CallsPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null | undefined>(undefined);
  const [brain, setBrain] = useState<ClientBrain | null>(null);
  const [callRows, setCallRows] = useState<Call[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const res = await apiFetch(`/api/clients/${encodeURIComponent(id)}`);
      if (cancelled) return;
      if (res.status === 404) {
        setClient(null);
        setBrain(null);
        setCallRows([]);
        return;
      }
      const data = (await res.json()) as { client: Client; brain: ClientBrain; calls: Call[] };
      setClient(data.client);
      setBrain(data.brain);
      setCallRows(data.calls);
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
        <div className="mt-2 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{client.name} — Call History</h1>
            <p className="mt-1 text-[13px] text-text-muted">
              {callRows.length} call{callRows.length === 1 ? '' : 's'} processed
            </p>
          </div>
          <TranscriptUploader clientId={client.id} />
        </div>
      </div>
      <CallTimeline entries={brain.call_log ?? []} clientId={client.id} />
    </div>
  );
}
