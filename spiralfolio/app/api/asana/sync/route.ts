import { NextResponse } from 'next/server';
import { getClient, getClientBrain } from '@/lib/db/queries';
import { syncDeliverablesToAsana } from '@/lib/integrations/asana';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const clientId = String(body.client_id ?? body.clientId ?? body.project_id ?? body.projectId ?? '');
  if (!clientId) return NextResponse.json({ error: 'client_id is required' }, { status: 400 });

  const [client, brain] = await Promise.all([
    getClient(clientId),
    getClientBrain(clientId),
  ]);
  if (!client) return NextResponse.json({ error: 'client not found' }, { status: 404 });

  const result = await syncDeliverablesToAsana({
    asanaProjectId: client.asanaProjectId,
    projectName: client.engagement ?? client.name,
    clientName: client.name,
    callType: 'manual-sync',
    callDate: new Date().toISOString().slice(0, 10),
    ourDeliverables: brain.our_deliverables ?? [],
    clientDeliverables: brain.client_deliverables ?? [],
  });
  return NextResponse.json(result);
}
