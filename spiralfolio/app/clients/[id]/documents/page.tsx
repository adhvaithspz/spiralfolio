import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getClient, getClientBrain } from '@/lib/db/queries';
import { DocumentsPanel } from '@/components/client/DocumentsPanel';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage({ params }: { params: { id: string } }) {
  const [client, brain] = await Promise.all([
    getClient(params.id),
    getClientBrain(params.id),
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
