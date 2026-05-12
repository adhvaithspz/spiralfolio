import 'server-only';
import { WebClient } from '@slack/web-api';
import type { ClientBrain, BrainConcern, BrainDeliverable } from '@/lib/db/brain';

let _client: WebClient | null = null;

function getSlack(): WebClient | null {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  if (!_client) _client = new WebClient(token);
  return _client;
}

export type SlackDigestInput = {
  clientId: string;
  callId: string;
  channelId: string;
  clientName: string;
  callType: string;
  callDate: string;
  keyUpdates: string[];
  brain: ClientBrain;
};

function pendingDeliverables(items: BrainDeliverable[] | undefined): BrainDeliverable[] {
  return (items ?? []).filter(d => (d.status ?? 'pending').toLowerCase() !== 'done');
}

function formatConcerns(concerns: BrainConcern[] | undefined): string {
  const open = concerns ?? [];
  if (open.length === 0) return '_None right now._';
  return open
    .map(c => `⚠️ ${c.concern}${c.owner ? ` — ${c.owner}` : ''}${c.blocker_for ? ` — blocking: ${c.blocker_for}` : ''}`)
    .join('\n');
}

function formatOurOwed(items: BrainDeliverable[] | undefined): string {
  const pending = pendingDeliverables(items);
  if (pending.length === 0) return '_Nothing pending._';
  return pending.map(d => `• ${d.item}`).join('\n');
}

function formatTheirOwed(items: BrainDeliverable[] | undefined): string {
  const pending = pendingDeliverables(items);
  if (pending.length === 0) return '_Nothing pending._';
  return pending
    .map(d => `• ${d.item}${d.owner ? ` — ${d.owner}` : ''}${d.due ? ` — due: ${d.due}` : ''}`)
    .join('\n');
}

/**
 * Posts a stakeholder digest to the project's Slack channel.
 * NEVER includes coaching content. Returns { posted: boolean, reason?: string }.
 */
export async function postCallDigest(input: SlackDigestInput): Promise<{ posted: boolean; reason?: string }> {
  const slack = getSlack();
  if (!slack) return { posted: false, reason: 'SLACK_BOT_TOKEN not configured' };
  if (!input.channelId) return { posted: false, reason: 'No slack_channel_id on client' };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const concerns = input.brain.open_concerns ?? [];

  const text = [
    `📋 *${input.clientName} — ${input.callType} Update* | ${input.callDate}`,
    '',
    '*Key updates from this call:*',
    input.keyUpdates.length ? input.keyUpdates.map(u => `• ${u}`).join('\n') : '_No key updates extracted._',
    '',
    `*Open concerns (${concerns.length}):*`,
    formatConcerns(concerns),
    '',
    '*We owe them:*',
    formatOurOwed(input.brain.our_deliverables),
    '',
    '*They owe us:*',
    formatTheirOwed(input.brain.client_deliverables),
    '',
    `<${appUrl}/clients/${input.clientId}|View full client> · <${appUrl}/api/briefing?client_id=${input.clientId}|Get AI briefing>`,
  ].join('\n');

  try {
    await slack.chat.postMessage({ channel: input.channelId, text, mrkdwn: true });
    return { posted: true };
  } catch (err) {
    return { posted: false, reason: (err as Error).message };
  }
}
