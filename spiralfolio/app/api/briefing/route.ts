import { NextResponse } from 'next/server';
import { getClient, getClientBrain } from '@/lib/db/queries';
import { generateBriefing } from '@/lib/ai/briefing';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get('client_id') ?? url.searchParams.get('project_id');
  if (!clientId) return NextResponse.json({ error: 'client_id is required' }, { status: 400 });

  const [client, brain] = await Promise.all([
    getClient(clientId),
    getClientBrain(clientId),
  ]);
  if (!client) return NextResponse.json({ error: 'client not found' }, { status: 404 });

  try {
    const briefing = await generateBriefing(brain);
    return NextResponse.json({ briefing });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
