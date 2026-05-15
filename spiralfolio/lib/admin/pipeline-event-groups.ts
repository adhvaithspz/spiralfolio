/**
 * Pure clustering + stage split for the admin pipeline log. Mirrors the client
 * explorer when **Group related** is on — used for summaries and must stay in
 * sync with `splitClusterIntoStages` in the UI module.
 */

import type { EventLog } from '@/lib/db/schema';
import {
  EVENT_GROUP_META,
  eventTypePipelineStage,
  type EventGroupId,
  type PipelineStageId,
} from '@/lib/admin/event-filters';

export type PipelineClusterGroup = {
  primary: EventLog;
  others: EventLog[];
};

export type StagedPipelineGroup = PipelineClusterGroup & {
  stageId: PipelineStageId;
};

const GROUP_WINDOW_MS = 30 * 60 * 1000;

export function meetingKey(row: EventLog): string | null {
  const mid = row.meetingId?.trim();
  if (mid) return `meeting:${mid}`;
  if (row.callId) return `call:${row.callId}`;
  if (row.meetingTopic) {
    const norm = row.meetingTopic.trim().toLowerCase().replace(/\s+/g, ' ');
    if (norm.length >= 3) return `topic:${norm}`;
  }
  return null;
}

export function toMs(d: Date | string): number {
  return (typeof d === 'string' ? new Date(d) : d).getTime();
}

export function isClientBrainPipelineEvent(e: EventLog): boolean {
  const t = e.eventType;
  return (
    t === 'transcript_uploaded' ||
    t === 'call_imported' ||
    t === 'brain_changed' ||
    t === 'call_processing_error'
  );
}

export function brainIngestChannel(events: EventLog[]): 'manual_upload' | 'integration' | null {
  if (!events.some(isClientBrainPipelineEvent)) return null;
  const tu = events.find(e => e.eventType === 'transcript_uploaded');
  const ci = events.find(e => e.eventType === 'call_imported');
  if (tu?.source === 'manual' || ci?.source === 'manual') return 'manual_upload';
  return 'integration';
}

/** Pipeline outcome shown only on grouped stage rows — strict Success / Error / Skipped. */
export type PipelineStatusWord = 'Success' | 'Error' | 'Skipped';

/** Meeting rollup — higher rank wins (Error dominates Skipped over Success). */
export const PIPELINE_STATUS_RANK: Record<PipelineStatusWord, number> = {
  Success: 1,
  Skipped: 2,
  Error: 3,
};

function analysedStageStatus(events: EventLog[], types: Set<string>): PipelineStatusWord {
  if (types.has('slack_dm_skipped') && !types.has('slack_dm_sent')) return 'Skipped';
  if (
    types.has('appscript_processing_error') ||
    types.has('call_processing_error') ||
    types.has('slack_dm_failed')
  ) {
    return 'Error';
  }

  const mergedBrain = events.some(isClientBrainPipelineEvent);
  const slackOk = types.has('slack_dm_sent');
  const brainOk = types.has('call_imported') || types.has('brain_changed');
  const coachingOk =
    types.has('appscript_processing_completed') || types.has('coaching_doc_created');

  if (mergedBrain) {
    const slackAttempted =
      types.has('slack_dm_sent') ||
      types.has('slack_dm_skipped') ||
      types.has('slack_dm_failed');
    if (brainOk && (!slackAttempted || slackOk)) return 'Success';
    return 'Error';
  }

  if (slackOk && coachingOk) return 'Success';
  return 'Error';
}

/**
 * Parent-row pipeline status for one stage cluster. Defaults to Error until the
 * stage meets Success criteria; Skipped covers intentional pipeline bypass (e.g.
 * internal call / no transcript / Slack DM skipped).
 */
export function pipelineStatusWordForStage(stageId: PipelineStageId, events: EventLog[]): PipelineStatusWord {
  const types = new Set(events.map(e => e.eventType));

  switch (stageId) {
    case 'call_skipped':
      return 'Skipped';
    case 'call_detected': {
      const ok =
        types.has('zoom_webhook_received') || types.has('cloudflare_webhook_received');
      return ok ? 'Success' : 'Error';
    }
    case 'call_analysed':
      return analysedStageStatus(events, types);
    case 'brain_manual': {
      if (types.has('call_processing_error')) return 'Error';
      if (types.has('call_imported') || types.has('brain_changed')) return 'Success';
      return 'Error';
    }
    case 'related':
    default: {
      if (
        types.has('call_processing_error') ||
        types.has('appscript_processing_error') ||
        types.has('slack_dm_failed')
      ) {
        return 'Error';
      }
      return 'Success';
    }
  }
}

function clusterNewestPrimary(run: EventLog[]): PipelineClusterGroup {
  const sortedDesc = [...run].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const [primary, ...others] = sortedDesc;
  return { primary, others };
}

/**
 * Cluster rows into one pipeline **run** per meeting/call/topic when timestamps
 * fall into contiguous windows (sorted by time — avoids fragmentation from DB order).
 */
export function groupRelatedEvents(rows: EventLog[]): PipelineClusterGroup[] {
  const out: PipelineClusterGroup[] = [];
  const noKey: EventLog[] = [];
  const byKey = new Map<string, EventLog[]>();

  for (const row of rows) {
    const k = meetingKey(row);
    if (!k) noKey.push(row);
    else {
      const arr = byKey.get(k) ?? [];
      arr.push(row);
      byKey.set(k, arr);
    }
  }

  for (const row of noKey) {
    out.push({ primary: row, others: [] });
  }

  for (const bucket of byKey.values()) {
    bucket.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
    let run: EventLog[] = [];
    for (const row of bucket) {
      if (run.length === 0) {
        run.push(row);
        continue;
      }
      const gap = toMs(row.createdAt) - toMs(run[run.length - 1]!.createdAt);
      if (gap <= GROUP_WINDOW_MS) {
        run.push(row);
      } else {
        out.push(clusterNewestPrimary(run));
        run = [row];
      }
    }
    if (run.length) out.push(clusterNewestPrimary(run));
  }

  out.sort((a, b) => toMs(b.primary.createdAt) - toMs(a.primary.createdAt));
  return out;
}

export function typesInSelectedEventGroups(groupIds: EventGroupId[]): Set<string> {
  const s = new Set<string>();
  for (const id of groupIds) {
    for (const t of EVENT_GROUP_META[id].types) s.add(t);
  }
  return s;
}

export function splitClusterIntoStages(cluster: PipelineClusterGroup): StagedPipelineGroup[] {
  const all = [cluster.primary, ...cluster.others];
  const byStage = new Map<PipelineStageId, EventLog[]>();
  for (const row of all) {
    const s = eventTypePipelineStage(row.eventType);
    const arr = byStage.get(s) ?? [];
    arr.push(row);
    byStage.set(s, arr);
  }

  const skipped = byStage.get('call_skipped');
  const detected = byStage.get('call_detected');
  if (skipped?.length && detected?.length) {
    skipped.push(...detected);
    byStage.delete('call_detected');
  }

  const analysed = byStage.get('call_analysed');
  if (skipped?.length && analysed?.length) {
    const analysedHadSuccess = analysed.some(
      e =>
        e.eventType === 'coaching_doc_created' ||
        e.eventType === 'appscript_processing_completed' ||
        e.eventType.startsWith('slack_dm_'),
    );
    if (!analysedHadSuccess) {
      const fold = analysed.filter(e => e.eventType === 'appscript_processing_started');
      const rest = analysed.filter(e => e.eventType !== 'appscript_processing_started');
      if (fold.length) {
        skipped.push(...fold);
        if (rest.length) byStage.set('call_analysed', rest);
        else byStage.delete('call_analysed');
      }
    }
  }

  const analysedMergeBrain = byStage.get('call_analysed');
  const brainOnly = byStage.get('brain_manual');
  if (analysedMergeBrain?.length && brainOnly?.length) {
    analysedMergeBrain.push(...brainOnly);
    byStage.delete('brain_manual');
  }

  const out: StagedPipelineGroup[] = [];
  for (const [stageId, events] of byStage) {
    const sorted = events.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    const [primary, ...others] = sorted;
    if (primary) out.push({ primary, others, stageId });
  }
  return out;
}

export function mergeStageGroupsForGroupFilter(
  groups: StagedPipelineGroup[],
  selectedGroupIds: EventGroupId[],
): StagedPipelineGroup[] {
  if (!selectedGroupIds.length) return groups;

  const allowed = typesInSelectedEventGroups(selectedGroupIds);
  const mergeableByKey = new Map<string, { byId: Map<string, EventLog>; stageId: PipelineStageId }>();
  const unmerged: StagedPipelineGroup[] = [];

  for (const g of groups) {
    const all = [g.primary, ...g.others];
    const keyBase = meetingKey(g.primary);
    const mergeKey = keyBase ? `${keyBase}::${g.stageId}` : null;
    const allAllowed = all.every(e => allowed.has(e.eventType));
    if (mergeKey && allAllowed) {
      let entry = mergeableByKey.get(mergeKey);
      if (!entry) {
        entry = { byId: new Map(), stageId: g.stageId };
        mergeableByKey.set(mergeKey, entry);
      }
      for (const e of all) {
        entry.byId.set(e.id, e);
      }
    } else {
      unmerged.push(g);
    }
  }

  const merged: StagedPipelineGroup[] = [];
  for (const entry of mergeableByKey.values()) {
    const events = [...entry.byId.values()].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    const [primary, ...others] = events;
    if (primary) {
      merged.push({
        primary,
        others,
        stageId: entry.stageId,
      });
    }
  }

  return [...merged, ...unmerged].sort((a, b) => toMs(b.primary.createdAt) - toMs(a.primary.createdAt));
}

/** One summary row per meeting / clustered run — worst stage outcome (Success / Error / Skipped). */
export function aggregatePipelineParents(
  rows: EventLog[],
  selectedGroupIds: EventGroupId[],
): { totalParents: number; byStatus: Record<PipelineStatusWord, number> } {
  let staged: StagedPipelineGroup[] = groupRelatedEvents(rows).flatMap(splitClusterIntoStages);
  if (selectedGroupIds.length) {
    staged = mergeStageGroupsForGroupFilter(staged, selectedGroupIds);
  }

  const byMeeting = new Map<string, StagedPipelineGroup[]>();
  for (const g of staged) {
    const k = meetingKey(g.primary) ?? `row:${g.primary.id}`;
    const arr = byMeeting.get(k) ?? [];
    arr.push(g);
    byMeeting.set(k, arr);
  }

  const byStatus: Record<PipelineStatusWord, number> = {
    Success: 0,
    Error: 0,
    Skipped: 0,
  };

  for (const stages of byMeeting.values()) {
    let worst: PipelineStatusWord = 'Success';
    let worstRank = PIPELINE_STATUS_RANK[worst];
    for (const stage of stages) {
      const all = [stage.primary, ...stage.others];
      const w = pipelineStatusWordForStage(stage.stageId, all);
      const r = PIPELINE_STATUS_RANK[w];
      if (r > worstRank) {
        worstRank = r;
        worst = w;
      }
    }
    byStatus[worst]++;
  }

  return { totalParents: byMeeting.size, byStatus };
}
