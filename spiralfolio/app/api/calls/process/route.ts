import { NextResponse } from 'next/server';
import { checkApiKey } from '@/lib/auth';
import { db } from '@/lib/db';
import { calls, documents } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { nanoid } from '@/lib/utils/nanoid';
import { getClient, getClientBrain } from '@/lib/db/queries';
import { applyCallSynthesis } from '@/lib/db/mutations';
import { safeStringify } from '@/lib/utils/json';
import { synthesizeCall } from '@/lib/ai/synthesis';
import { extractDocument } from '@/lib/ai/documents';

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

  try {
    const [synthesis, docExtraction] = await Promise.all([
      synthesizeCall({
        projectName: client.engagement ?? client.name,
        clientName: client.name,
        callType,
        callDate,
        transcript,
      }),
      extractDocument({
        filename,
        projectName: client.engagement ?? client.name,
        clientName: client.name,
        content: transcript.slice(0, 30_000),
      }).catch(() => null),
    ]);

    const changes = await applyCallSynthesis({ clientId, synthesis, at: now });

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
    }).where(eq(calls.id, callId));

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
    });
  } catch (err) {
    await db.update(calls).set({ status: 'error' }).where(eq(calls.id, callId));
    return NextResponse.json({ error: (err as Error).message, call_id: callId }, { status: 500 });
  }
}
