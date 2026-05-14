import { NextResponse } from 'next/server';
import { checkApiKey } from '@/lib/auth';
import { db } from '@/lib/db';
import { calls, documents } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { nanoid } from '@/lib/utils/nanoid';
import { getClient, getClientBrain } from '@/lib/db/queries';
import { applyCallSynthesis } from '@/lib/db/mutations';
import { safeStringify } from '@/lib/utils/json';
import { synthesizeCall, buildPriorContext } from '@/lib/ai/synthesis';
import { extractDocument } from '@/lib/ai/documents';
import { logEvent } from '@/lib/db/events';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const authError = checkApiKey(req);
  if (authError) return authError;

  let clientId: string;
  let transcript: string;
  let callDate: string;
  let callType: string;
  let filename: string;

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const fd = await req.formData();
    clientId = String(fd.get('client_id') ?? '').trim();
    callDate = String(fd.get('call_date') ?? new Date().toISOString().slice(0, 10));
    callType = String(fd.get('call_type') ?? 'weekly');

    const file = fd.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 });

    filename = file.name;
    const buf = Buffer.from(await file.arrayBuffer());
    const pdfParse = (await import('pdf-parse')).default;
    const parsed = await pdfParse(buf);
    transcript = parsed.text.trim();

    if (!transcript) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 422 });
    }
  } else {
    const body = await req.json().catch(() => ({}));
    clientId = String(body.client_id ?? body.clientId ?? body.project_id ?? body.projectId ?? '').trim();
    transcript = String(body.transcript_text ?? body.transcript ?? '').trim();
    callDate = String(body.call_date ?? body.callDate ?? new Date().toISOString().slice(0, 10));
    callType = String(body.call_type ?? body.callType ?? 'weekly');
    filename = `Transcript ${callDate}`;
  }

  if (!clientId || !transcript) {
    return NextResponse.json({ error: 'client_id and transcript_text are required' }, { status: 400 });
  }

  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: 'client not found' }, { status: 404 });

  // Idempotency guard: if a non-failed call already exists for this
  // client + date + type, return the existing record instead of creating
  // a duplicate. This catches double-posts from the Apps Script retry
  // logic as a second line of defence.
  const [duplicate] = await db
    .select({ id: calls.id, status: calls.status })
    .from(calls)
    .where(
      and(
        eq(calls.clientId, clientId),
        eq(calls.callDate, callDate),
        eq(calls.callType, callType)
      )
    )
    .limit(1);

  if (duplicate && duplicate.status !== 'error') {
    await logEvent({
      eventType: 'transcript_uploaded',
      source: 'manual',
      severity: 'warning',
      message: `Duplicate transcript ignored — call already exists for ${client.name} on ${callDate} (${callType})`,
      clientId,
      clientName: client.name,
      callId: duplicate.id,
      callDate,
      payload: { duplicate: true, filename, transcriptLength: transcript.length },
    });
    return NextResponse.json(
      { error: 'duplicate_call', call_id: duplicate.id, message: 'A call with this date and type already exists for this client.' },
      { status: 409 }
    );
  }

  const callId = nanoid();
  const now = new Date();
  await db.insert(calls).values({
    id: callId,
    clientId,
    callDate,
    callType,
    rawTranscript: transcript,
    status: 'processing',
    createdAt: now,
  });

  await logEvent({
    eventType: 'transcript_uploaded',
    source: 'manual',
    severity: 'info',
    message: `Transcript received — ${client.name} · ${callDate} (${callType})`,
    clientId,
    clientName: client.name,
    callId,
    callDate,
    payload: { filename, transcriptLength: transcript.length, phase: 'queued' },
  });

  try {
    // Snapshot prior brain BEFORE this call mutates it so the AI can
    // reference existing items by stable refs (C1, D2, …).
    const priorBrain = await getClientBrain(clientId);
    const priorContext = buildPriorContext(priorBrain);

    const [{ synthesis, refs }, docExtraction] = await Promise.all([
      synthesizeCall({
        projectName: client.engagement ?? client.name,
        clientName: client.name,
        callType,
        callDate,
        transcript,
        prior: priorContext,
      }),
      extractDocument({
        filename,
        projectName: client.engagement ?? client.name,
        clientName: client.name,
        content: transcript.slice(0, 30_000),
      }).catch(() => null),
    ]);

    const changes = await applyCallSynthesis({
      clientId,
      synthesis,
      refs,
      callId,
      callDate,
      at: now,
    });

    if (docExtraction) {
      await db.insert(documents).values({
        id: nanoid(),
        clientId,
        name: filename,
        docType: docExtraction.type,
        keyFacts: safeStringify(docExtraction.key_facts),
        flags: safeStringify(docExtraction.flags),
        ingestedAt: now,
      });
    }

    const updatedBrain = await getClientBrain(clientId);

    await db.update(calls).set({
      status: 'done',
      callSummary: synthesis.call_summary,
      keyUpdates: safeStringify(synthesis.key_updates),
      attendeesClient: safeStringify(synthesis.attendees_client),
      attendeesInternal: safeStringify(synthesis.attendees_internal),
      brainSnapshot: safeStringify(updatedBrain),
      brainChanges: safeStringify(changes),
    }).where(eq(calls.id, callId));

    const changesSummary = {
      new_contacts: changes.contacts_added,
      new_concerns: changes.concerns_added,
      resolved_concerns: changes.concerns_resolved,
      extended_concerns: changes.concerns_extended,
      new_deliverables: changes.deliverables_added,
      completed_deliverables: changes.deliverables_completed,
      extended_deliverables: changes.deliverables_extended + changes.deliverables_status_changed,
      decisions_made: changes.decisions_added,
      wins: changes.wins_added,
    };

    const changeCount = Object.values(changesSummary).reduce((a, b) => a + b, 0);
    const brainSummary = changeCount > 0 ? describeChanges(changesSummary) : 'no brain changes';

    await logEvent({
      eventType: 'call_imported',
      severity: 'success',
      message: `Imported ${callType} call for ${client.name} (${callDate}) — ${brainSummary}`,
      clientId,
      clientName: client.name,
      callId,
      callDate,
      payload: {
        filename,
        transcriptLength: transcript.length,
        callSummary: synthesis.call_summary,
        attendeesClient: synthesis.attendees_client,
        attendeesInternal: synthesis.attendees_internal,
        documentsExtracted: docExtraction ? 1 : 0,
        brainChanges: changesSummary,
        durationMs: Date.now() - now.getTime(),
      },
    });

    return NextResponse.json({
      call_id: callId,
      updated_brain: updatedBrain,
      call_summary: synthesis.call_summary,
      changes_summary: changesSummary,
    });
  } catch (err) {
    await db.update(calls).set({ status: 'error' }).where(eq(calls.id, callId));
    await logEvent({
      eventType: 'call_processing_error',
      severity: 'error',
      message: `Processing failed for ${client.name} (${callDate}): ${(err as Error).message}`,
      clientId,
      clientName: client.name,
      callId,
      callDate,
      payload: { error: (err as Error).message, stack: (err as Error).stack ?? null },
    });
    return NextResponse.json({ error: (err as Error).message, call_id: callId }, { status: 500 });
  }
}

function describeChanges(c: {
  new_contacts: number;
  new_concerns: number;
  resolved_concerns: number;
  extended_concerns: number;
  new_deliverables: number;
  completed_deliverables: number;
  extended_deliverables: number;
  decisions_made: number;
  wins: number;
}): string {
  const parts: string[] = [];
  if (c.new_contacts) parts.push(`${c.new_contacts} contact${c.new_contacts === 1 ? '' : 's'}`);
  if (c.new_concerns) parts.push(`${c.new_concerns} new concern${c.new_concerns === 1 ? '' : 's'}`);
  if (c.resolved_concerns) parts.push(`${c.resolved_concerns} resolved`);
  if (c.extended_concerns) parts.push(`${c.extended_concerns} concern update${c.extended_concerns === 1 ? '' : 's'}`);
  if (c.new_deliverables) parts.push(`${c.new_deliverables} new deliverable${c.new_deliverables === 1 ? '' : 's'}`);
  if (c.completed_deliverables) parts.push(`${c.completed_deliverables} completed`);
  if (c.extended_deliverables) parts.push(`${c.extended_deliverables} deliverable update${c.extended_deliverables === 1 ? '' : 's'}`);
  if (c.decisions_made) parts.push(`${c.decisions_made} decision${c.decisions_made === 1 ? '' : 's'}`);
  if (c.wins) parts.push(`${c.wins} win${c.wins === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : 'no changes';
}
