/**
 * Pure clustering + stage split for the admin pipeline log. Mirrors the client
 * explorer when **Group related** is on — used for summaries and must stay in
 * sync with `EventLogExplorer` (including {@link collapseStagedGroupsByMeetingKey}
 * so list rows match summary totals).
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
  /**
   * When several time-split runs share the same meeting key, the summary strip uses
   * the worst status across those runs — mirror that here so the row badge matches.
   */
  meetingRollupStatus?: PipelineStatusWord;
};

const GROUP_WINDOW_MS = 30 * 60 * 1000;

function normalizeTopic(topic: string | null | undefined): string {
  if (!topic?.trim()) return '';
  return topic.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCallDay(callDate: string | null | undefined): string | null {
  if (!callDate?.trim()) return null;
  const s = callDate.trim();
  const head = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Token for client + calendar day + topic — links Zoom rows (meeting id) to SpiralFolio rows (call id). */
function ctdToken(clientId: string, day: string, topicNorm: string): string {
  return `ctd:${clientId}|${day}|${topicNorm}`;
}

export function parseCtdCorrelationToken(token: string): { clientId: string; day: string; topic: string } | null {
  if (!token.startsWith('ctd:')) return null;
  const rest = token.slice(4);
  const i = rest.indexOf('|');
  const j = rest.indexOf('|', i + 1);
  if (i <= 0 || j <= i + 1) return null;
  return {
    clientId: rest.slice(0, i),
    day: rest.slice(i + 1, j),
    topic: rest.slice(j + 1),
  };
}

/**
 * All correlation handles for one row. Rows that share any token belong in one pipeline group
 * (before the 30‑minute window splits runs).
 */
export function collectCorrelationTokens(row: EventLog): string[] {
  const tokens: string[] = [];
  const mid = row.meetingId?.trim();
  if (mid) tokens.push(`meeting:${mid}`);
  const cid = row.callId?.trim();
  if (cid) tokens.push(`call:${cid}`);
  const topic = normalizeTopic(row.meetingTopic);
  if (topic.length >= 3) {
    tokens.push(`topic:${topic}`);
    const day = normalizeCallDay(row.callDate);
    const cli = row.clientId?.trim();
    if (cli && day) tokens.push(ctdToken(cli, day, topic));
  }
  return tokens;
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) {
      const root = this.find(p);
      this.parent.set(x, root);
      return root;
    }
    return p;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

export function meetingKey(row: EventLog): string | null {
  const mid = row.meetingId?.trim();
  if (mid) return `meeting:${mid}`;
  const cid = row.callId?.trim();
  if (cid) return `call:${cid}`;
  const topic = normalizeTopic(row.meetingTopic);
  if (topic.length >= 3) return `topic:${topic}`;
  return null;
}

/**
 * Bucket key for admin summaries and grouped rows — **not** only {@link meetingKey}
 * on the newest primary. SpiralFolio rows often omit Zoom `meetingId` while older
 * webhook rows in the same cluster still have it; using only the primary splits one
 * meeting into multiple buckets and breaks totals vs the status strip.
 *
 * Prefers `ctd:` (client + calendar day + topic) when present so Apps Script /
 * SpiralFolio legs tie to Zoom legs without a shared numeric id.
 */
export function meetingBucketKeyForStagedGroup(g: StagedPipelineGroup): string {
  const rows = [g.primary, ...g.others];
  for (const row of rows) {
    const mid = row.meetingId?.trim();
    if (mid) return `meeting:${mid}`;
  }
  for (const row of rows) {
    const cid = row.callId?.trim();
    if (cid) return `call:${cid}`;
  }
  for (const row of rows) {
    for (const tok of collectCorrelationTokens(row)) {
      if (tok.startsWith('ctd:')) return tok;
    }
  }
  const topicRow = rows.find(r => normalizeTopic(r.meetingTopic).length >= 3);
  const topic = normalizeTopic(topicRow?.meetingTopic ?? g.primary.meetingTopic);
  if (topic.length >= 3) return `topic:${topic}`;
  return `row:${g.primary.id}`;
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

/**
 * Worst pipeline outcome when multiple stages are merged into one parent row
 * ({@link collapseStagesPerMeetingCluster} → `stageId: 'related'`).
 */
export function pipelineStatusWordForMergedCluster(events: EventLog[]): PipelineStatusWord {
  const byStage = new Map<PipelineStageId, EventLog[]>();
  for (const row of events) {
    const s = eventTypePipelineStage(row.eventType);
    const arr = byStage.get(s) ?? [];
    arr.push(row);
    byStage.set(s, arr);
  }
  let worst: PipelineStatusWord = 'Success';
  let worstRank = PIPELINE_STATUS_RANK[worst];
  for (const [stageId, evs] of byStage) {
    const w = pipelineStatusWordForStage(stageId, evs);
    const r = PIPELINE_STATUS_RANK[w];
    if (r > worstRank) {
      worstRank = r;
      worst = w;
    }
  }
  return worst;
}

/** Short subhead when multiple stages are collapsed into one row. */
export function describeMergedMeetingSummary(events: EventLog[]): string {
  const stages = new Set(events.map(e => eventTypePipelineStage(e.eventType)));
  const parts: string[] = [];
  const order: PipelineStageId[] = ['call_detected', 'call_skipped', 'call_analysed', 'brain_manual', 'related'];
  for (const sid of order) {
    if (!stages.has(sid)) continue;
    if (sid === 'related') parts.push('Other');
    else if (sid === 'brain_manual') {
      const ch = brainIngestChannel(events);
      parts.push(
        ch === 'manual_upload' ? EVENT_GROUP_META.brain_manual.label : 'brain updated automatically',
      );
    } else parts.push(EVENT_GROUP_META[sid].label);
  }
  if (!parts.length) return 'Events for this meeting — expand for detail';
  return `${parts.join(' · ')} — expand for raw lines`;
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
  const rowTokenLists = rows.map(r => collectCorrelationTokens(r));

  const uf = new UnionFind();
  for (const tokens of rowTokenLists) {
    if (tokens.length === 0) continue;
    const head = tokens[0]!;
    for (let i = 1; i < tokens.length; i++) uf.union(head, tokens[i]!);
  }

  const byRoot = new Map<string, EventLog[]>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const tokens = rowTokenLists[i]!;
    if (tokens.length === 0) {
      noKey.push(row);
      continue;
    }
    const root = uf.find(tokens[0]!);
    const arr = byRoot.get(root) ?? [];
    arr.push(row);
    byRoot.set(root, arr);
  }

  for (const row of noKey) {
    out.push({ primary: row, others: [] });
  }

  for (const bucket of byRoot.values()) {
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

/**
 * After {@link splitClusterIntoStages}, collapse all stages from the **same**
 * meeting cluster into one expandable parent row so detect / skip / analyse /
 * brain appear together.
 */
export function collapseStagesPerMeetingCluster(stages: StagedPipelineGroup[]): StagedPipelineGroup[] {
  if (stages.length <= 1) return stages;
  const byId = new Map<string, EventLog>();
  for (const s of stages) {
    byId.set(s.primary.id, s.primary);
    for (const o of s.others) byId.set(o.id, o);
  }
  const merged = [...byId.values()].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  const [primary, ...others] = merged;
  if (!primary) return stages;
  return [{ primary, others, stageId: 'related' }];
}

/** Worst outcome across staged rows for the same meeting (matches admin summary bucketing). */
export function worstPipelineStatusAcrossStaged(stages: StagedPipelineGroup[]): PipelineStatusWord {
  let worst: PipelineStatusWord = 'Success';
  let worstRank = PIPELINE_STATUS_RANK[worst];
  for (const stage of stages) {
    const all = [stage.primary, ...stage.others];
    const w =
      stage.stageId === 'related'
        ? pipelineStatusWordForMergedCluster(all)
        : pipelineStatusWordForStage(stage.stageId, all);
    const r = PIPELINE_STATUS_RANK[w];
    if (r > worstRank) {
      worstRank = r;
      worst = w;
    }
  }
  return worst;
}

/**
 * Merge staged rows that belong to the **same meeting handle** (Zoom meeting id,
 * SpiralFolio call id, or normalized topic) into one expandable group.
 *
 * {@link groupRelatedEvents} can emit multiple runs per meeting when events fall
 * outside the 30‑minute merge window; the admin summary still counts those as one
 * meeting via {@link aggregatePipelineParents}. Collapsing here keeps the event
 * list aligned with that total so operators do not double-count.
 */
export function collapseStagedGroupsByMeetingKey(groups: StagedPipelineGroup[]): StagedPipelineGroup[] {
  const buckets = new Map<string, StagedPipelineGroup[]>();
  for (const g of groups) {
    const k = meetingBucketKeyForStagedGroup(g);
    const arr = buckets.get(k) ?? [];
    arr.push(g);
    buckets.set(k, arr);
  }

  const out: StagedPipelineGroup[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      out.push(bucket[0]!);
      continue;
    }
    const byId = new Map<string, EventLog>();
    for (const g of bucket) {
      byId.set(g.primary.id, g.primary);
      for (const o of g.others) byId.set(o.id, o);
    }
    const merged = [...byId.values()].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
    const [primary, ...others] = merged;
    if (primary) {
      out.push({
        primary,
        others,
        stageId: 'related',
        meetingRollupStatus: worstPipelineStatusAcrossStaged(bucket),
      });
    }
  }

  out.sort((a, b) => toMs(b.primary.createdAt) - toMs(a.primary.createdAt));
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
    const bucketKey = meetingBucketKeyForStagedGroup(g);
    const mergeKey = bucketKey.startsWith('row:') ? null : `${bucketKey}::${g.stageId}`;
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
  let staged: StagedPipelineGroup[] = groupRelatedEvents(rows).flatMap(c =>
    collapseStagesPerMeetingCluster(splitClusterIntoStages(c)),
  );
  if (selectedGroupIds.length) {
    staged = mergeStageGroupsForGroupFilter(staged, selectedGroupIds);
  }

  const byMeeting = new Map<string, StagedPipelineGroup[]>();
  for (const g of staged) {
    const k = meetingBucketKeyForStagedGroup(g);
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
    byStatus[worstPipelineStatusAcrossStaged(stages)]++;
  }

  return { totalParents: byMeeting.size, byStatus };
}
