import { NextResponse } from 'next/server';
import { checkApiKey } from '@/lib/auth';
import { updateCallSchedule } from '@/lib/db/mutations';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { callId: string } }) {
  const authError = checkApiKey(req);
  if (authError) return authError;

  const callId = params.callId?.trim();
  if (!callId) {
    return NextResponse.json({ error: 'Missing call id' }, { status: 400 });
  }

  let body: {
    client_id?: string;
    clientId?: string;
    call_date?: string;
    callDate?: string;
    call_type?: string;
    callType?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const clientId = String(body.client_id ?? body.clientId ?? '').trim();
  if (!clientId) {
    return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
  }

  const callDate = String(body.call_date ?? body.callDate ?? '').trim();
  if (!callDate) {
    return NextResponse.json({ error: 'call_date is required' }, { status: 400 });
  }

  const callTypeRaw = body.call_type ?? body.callType;
  const callType =
    callTypeRaw === undefined || callTypeRaw === null ? undefined : String(callTypeRaw).trim() || undefined;

  const result = await updateCallSchedule({
    callId,
    clientId,
    callDate,
    ...(callType !== undefined ? { callType } : {}),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true, call_id: callId, call_date: callDate });
}
