import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calls } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from '@/lib/utils/nanoid';
import { getClient, getClientBrain } from '@/lib/db/queries';
import { applyCallSynthesis } from '@/lib/db/mutations';
import { safeStringify } from '@/lib/utils/json';
import { synthesizeCall } from '@/lib/ai/synthesis';
import { generateCoaching } from '@/lib/ai/coaching';
import { postCallDigest } from '@/lib/integrations/slack';
import { syncDeliverablesToAsana } from '@/lib/integrations/asana';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const clientId = String(body.client_id ?? body.clientId ?? body.project_id ?? body.projectId ?? '').trim();
  const transcript = String(body.transcript_text ?? body.transcript ?? '').trim();
  const callDate = String(body.call_date ?? body.callDate ?? new Date().toISOString().slice(0, 10));
  const callType = String(body.call_type ?? body.callType ?? 'weekly');

  if (!clientId || !transcript) {
    return NextResponse.json({ error: 'client_id and transcript_text are required' }, { status: 400 });
  }

  const client = getClient(clientId);
  if (!client) return NextResponse.json({ error: 'client not found' }, { status: 404 });

  const callId = nanoid();
  const now = new Date();
  db.insert(calls)
    .values({
      id: callId,
      clientId,
      callDate,
      callType,
      rawTranscript: transcript,
      status: 'processing',
      createdAt: now,
    })
    .run();

  try {
    const synthesis = await synthesizeCall({
      projectName: client.engagement ?? client.name,
      clientName: client.name,
      callType,
      callDate,
      transcript,
    });

    const changes = applyCallSynthesis({ clientId, synthesis, at: now });

    let coachingDoc = '';
    try {
      coachingDoc = await generateCoaching(transcript);
    } catch {
      coachingDoc = '';
    }

    const updatedBrain = getClientBrain(clientId);

    db.update(calls)
      .set({
        status: 'done',
        callSummary: synthesis.call_summary,
        keyUpdates: safeStringify(synthesis.key_updates),
        attendeesClient: safeStringify(synthesis.attendees_client),
        attendeesInternal: safeStringify(synthesis.attendees_internal),
        brainSnapshot: safeStringify(updatedBrain),
        coachingDoc,
      })
      .where(eq(calls.id, callId))
      .run();

    const integrations: Record<string, unknown> = {};
    if (client.slackChannelId) {
      integrations.slack = await postCallDigest({
        clientId,
        callId,
        channelId: client.slackChannelId,
        clientName: client.name,
        callType,
        callDate,
        keyUpdates: synthesis.key_updates,
        brain: updatedBrain,
      });
    }
    if (client.asanaProjectId) {
      integrations.asana = await syncDeliverablesToAsana({
        asanaProjectId: client.asanaProjectId,
        projectName: client.engagement ?? client.name,
        clientName: client.name,
        callType,
        callDate,
        ourDeliverables: updatedBrain.our_deliverables ?? [],
        clientDeliverables: updatedBrain.client_deliverables ?? [],
      });
    }

    return NextResponse.json({
      call_id: callId,
      updated_brain: updatedBrain,
      call_summary: synthesis.call_summary,
      changes_summary: {
        new_contacts: changes.contactsAdded,
        new_concerns: changes.concernsAdded,
        resolved_concerns: changes.concernsResolved,
        new_deliverables: changes.deliverablesAdded,
        updated_deliverables: changes.deliverablesUpdated,
        decisions_made: changes.decisionsAdded,
        wins: changes.winsAdded,
      },
      integrations,
    });
  } catch (err) {
    db.update(calls).set({ status: 'error' }).where(eq(calls.id, callId)).run();
    return NextResponse.json({ error: (err as Error).message, call_id: callId }, { status: 500 });
  }
}
