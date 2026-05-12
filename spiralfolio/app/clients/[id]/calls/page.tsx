import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getClient, getClientBrain, listCalls } from '@/lib/db/queries';
import { CallTimeline } from '@/components/client/CallTimeline';
import { TranscriptUploader } from '@/components/calls/TranscriptUploader';

export const dynamic = 'force-dynamic';

export default async function CallsPage({ params }: { params: { id: string } }) {
  const [client, brain, callRows] = await Promise.all([
    getClient(params.id),
    getClientBrain(params.id),
    listCalls(params.id),
  ]);
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/clients/${client.id}`}
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
      <CallTimeline entries={brain.call_log ?? []} />
    </div>
  );
}
