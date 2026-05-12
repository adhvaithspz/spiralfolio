import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calls } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getClient, getClientBrain } from '@/lib/db/queries';
import { safeParse } from '@/lib/utils/json';
import { postCallDigest } from '@/lib/integrations/slack';
import type { ClientBrain } from '@/lib/db/brain';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const clientId = String(body.client_id ?? body.clientId ?? body.project_id ?? body.projectId ?? '');
  const callId = String(body.call_id ?? body.callId ?? '');
  if (!clientId || !callId) {
    return NextResponse.json({ error: 'client_id and call_id are required' }, { status: 400 });
  }

  const client = getClient(clientId);
  const call = db.select().from(calls).where(eq(calls.id, callId)).get();
  if (!client || !call) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const brain = call.brainSnapshot
    ? safeParse<ClientBrain>(call.brainSnapshot, getClientBrain(clientId))
    : getClientBrain(clientId);

  const result = await postCallDigest({
    clientId,
    callId,
    channelId: client.slackChannelId ?? '',
    clientName: client.name,
    callType: call.callType ?? 'update',
    callDate: call.callDate,
    keyUpdates: safeParse<string[]>(call.keyUpdates ?? '[]', []),
    brain,
  });

  return NextResponse.json(result, { status: result.posted ? 200 : 400 });
}
