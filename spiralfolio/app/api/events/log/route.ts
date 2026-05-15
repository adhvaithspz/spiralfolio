import { NextResponse } from 'next/server';
import { checkApiKey } from '@/lib/auth';
import { logEvent, type LogEventInput } from '@/lib/db/events';
import type { EventSeverity, EventSource } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

const SOURCES: EventSource[] = ['spiralfolio', 'appscript', 'cloudflare', 'manual', 'zoom', 'slack'];
const SEVERITIES: EventSeverity[] = ['info', 'success', 'warning', 'error'];

/**
 * POST /api/events/log
 *
 * Ingestion endpoint used by the Apps Script (and optionally the Cloudflare
 * worker) to push pipeline events into the SpiralFolio admin dashboard.
 *
 * Auth: Bearer token (SPIRALFOLIO_API_KEY). Same convention as
 * /api/calls/process.
 *
 * Body shape (all fields optional except `event_type`):
 *   {
 *     event_type:           string,        // e.g. "slack_dm_sent"
 *     source:               string,        // "appscript" | "slack" | "cloudflare" | ...
 *     severity:             string,        // "info" | "success" | ...
 *     message:              string,
 *     client_name:          string,
 *     client_id:            string,
 *     meeting_id:           string,
 *     meeting_topic:        string,
 *     call_id:              string,
 *     call_date:            string,
 *     doc_url:              string,
 *     slack_recipient:      string,
 *     slack_recipient_email:string,
 *     slack_message:        string,
 *     slack_channel_id:     string,
 *     slack_ts:             string,
 *     payload:              any,
 *     occurred_at:          string  // ISO timestamp; defaults to now
 *   }
 *
 * Always returns 200 once auth passes. Logging failures are swallowed
 * server-side so the caller (Apps Script) cannot get into a broken state.
 */
export async function POST(req: Request) {
  const authError = checkApiKey(req);
  if (authError) return authError;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const eventType = String(body.event_type ?? body.eventType ?? '').trim();
  if (!eventType) {
    return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
  }

  const sourceRaw = String(body.source ?? 'appscript') as EventSource;
  const severityRaw = String(body.severity ?? 'info') as EventSeverity;
  let source: EventSource = SOURCES.includes(sourceRaw) ? sourceRaw : 'appscript';
  if (eventType === 'zoom_webhook_received' || eventType.startsWith('zoom_')) {
    source = 'zoom';
  }
  const severity: EventSeverity = SEVERITIES.includes(severityRaw) ? severityRaw : 'info';

  const at = (() => {
    const v = body.occurred_at ?? body.occurredAt ?? body.at;
    if (typeof v !== 'string') return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  })();

  const input: LogEventInput = {
    eventType,
    source,
    severity,
    message: optionalString(body.message),
    clientId: optionalString(body.client_id ?? body.clientId),
    clientName: optionalString(body.client_name ?? body.clientName),
    meetingId: optionalString(body.meeting_id ?? body.meetingId),
    meetingTopic: optionalString(body.meeting_topic ?? body.meetingTopic),
    callId: optionalString(body.call_id ?? body.callId),
    callDate: optionalString(body.call_date ?? body.callDate),
    docUrl: optionalString(body.doc_url ?? body.docUrl),
    slackRecipient: optionalString(body.slack_recipient ?? body.slackRecipient),
    slackRecipientEmail: optionalString(body.slack_recipient_email ?? body.slackRecipientEmail),
    slackMessage: optionalString(body.slack_message ?? body.slackMessage),
    slackChannelId: optionalString(body.slack_channel_id ?? body.slackChannelId),
    slackTs: optionalString(body.slack_ts ?? body.slackTs),
    payload: body.payload ?? null,
    at,
  };

  const id = await logEvent(input);
  return NextResponse.json({ ok: true, id });
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}
