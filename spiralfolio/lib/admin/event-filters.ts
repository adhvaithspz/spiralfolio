/**
 * Admin event log: pipeline "groups" are a separate filter dimension from raw
 * `event_type` values. URLs use `event_groups=client_brain,call_skipped`; the
 * server expands them into concrete types for SQL.
 */

export const EVENT_GROUP_IDS = ['client_brain', 'call_skipped'] as const;
export type EventGroupId = (typeof EVENT_GROUP_IDS)[number];

/** Webhook hops before Apps Script records `appscript_processing_skipped`. */
export const CALL_SKIPPED_UPSTREAM_EVENT_TYPES = [
  'cloudflare_webhook_received',
  'zoom_webhook_received',
] as const;

export const EVENT_GROUP_META: Record<
  EventGroupId,
  { label: string; types: string[] }
> = {
  client_brain: {
    label: 'Client brain updated',
    types: ['transcript_uploaded', 'call_imported', 'brain_changed'],
  },
  call_skipped: {
    label: 'Call skipped',
    types: ['appscript_processing_skipped', ...CALL_SKIPPED_UPSTREAM_EVENT_TYPES],
  },
};

export function isEventGroupId(v: string): v is EventGroupId {
  return (EVENT_GROUP_IDS as readonly string[]).includes(v);
}

/** Merge individual event types + expanded group types (deduped). */
export function mergeEventTypeFilters(individual: string[], groupIds: string[]): string[] {
  const out = new Set<string>(individual.filter(Boolean));
  for (const g of groupIds) {
    if (!isEventGroupId(g)) continue;
    for (const t of EVENT_GROUP_META[g].types) out.add(t);
  }
  return [...out];
}

export function parseEventGroupsParam(raw: string | null | undefined): EventGroupId[] {
  if (!raw) return [];
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  return parts.filter((p): p is EventGroupId => isEventGroupId(p));
}
