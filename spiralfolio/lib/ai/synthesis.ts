import { runClaude } from './client';
import { parseModelJson } from '@/lib/utils/json';
import type { BrainConcern, BrainDeliverable, ClientBrain } from '@/lib/db/brain';

/**
 * Synthesis output. Concerns + deliverables use refs for resolve / extend /
 * complete. Decisions and wins are append-only per call — output goes only in
 * `new_decisions` / `new_wins`.
 *
 * "ref" fields are short tokens (C1, D2, …) the prompt assigns to each
 * existing concern/deliverable. Server-side maps ref → DB id.
 */
export type CallSynthesis = {
  call_summary: string;
  key_updates: string[];
  attendees_client: string[];
  attendees_internal: string[];

  new_contacts: { name: string; role?: string; notes?: string; is_approver?: boolean }[];

  resolved_concerns: { ref?: string; text?: string; note?: string }[];
  updated_concerns: {
    ref: string;
    new_status?: string;
    new_owner?: string;
    new_blocker_for?: string;
    change_note?: string;
  }[];
  new_concerns: { concern: string; owner?: string; blocker_for?: string; status?: string }[];

  completed_deliverables: { ref: string; note?: string }[];
  updated_deliverables: {
    ref: string;
    new_status?: string;
    new_details?: string;
    new_owner?: string;
    new_due?: string;
    change_note?: string;
  }[];
  new_our_deliverables: { item: string; details?: string; status?: string }[];
  new_client_deliverables: { item: string; owner?: string; due?: string; status?: string }[];

  new_decisions: string[];
  new_wins: string[];
};

const EMPTY: CallSynthesis = {
  call_summary: '',
  key_updates: [],
  attendees_client: [],
  attendees_internal: [],
  new_contacts: [],
  resolved_concerns: [],
  updated_concerns: [],
  new_concerns: [],
  completed_deliverables: [],
  updated_deliverables: [],
  new_our_deliverables: [],
  new_client_deliverables: [],
  new_decisions: [],
  new_wins: [],
};

type RefMap = {
  concerns: Map<string, string>;
  deliverables: Map<string, string>;
};

export type PriorBrainContext = {
  open_concerns: (BrainConcern & { id: string })[];
  open_deliverables: (BrainDeliverable & { id: string; side: 'us' | 'client' })[];
};

export function buildPriorContext(brain: ClientBrain): PriorBrainContext {
  const open_concerns = (brain.open_concerns ?? []).filter(
    (c): c is BrainConcern & { id: string } => !!c.id,
  );
  const ours = (brain.our_deliverables ?? []).map(d => ({ ...d, side: 'us' as const }));
  const theirs = (brain.client_deliverables ?? []).map(d => ({ ...d, side: 'client' as const }));
  const open_deliverables = [...ours, ...theirs].filter(
    (d): d is BrainDeliverable & { id: string; side: 'us' | 'client' } =>
      !!d.id && (d.status ?? '').toLowerCase() !== 'done',
  );
  return { open_concerns, open_deliverables };
}

function buildRefBlocks(ctx: PriorBrainContext): { prompt: string; refs: RefMap } {
  const refs: RefMap = {
    concerns: new Map(),
    deliverables: new Map(),
  };

  const lines: string[] = [];

  if (ctx.open_concerns.length) {
    lines.push('OPEN CONCERNS (use these refs to mark resolved or extended):');
    ctx.open_concerns.forEach((c, i) => {
      const ref = `C${i + 1}`;
      refs.concerns.set(ref, c.id);
      const meta = [c.owner ? `owner: ${c.owner}` : '', c.blocker_for ? `blocking: ${c.blocker_for}` : '']
        .filter(Boolean)
        .join('; ');
      lines.push(`- ${ref} [${c.status ?? 'open'}]: ${c.concern}${meta ? `  (${meta})` : ''}`);
    });
    lines.push('');
  }

  if (ctx.open_deliverables.length) {
    lines.push('OPEN DELIVERABLES (use these refs to mark completed or extended):');
    ctx.open_deliverables.forEach((d, i) => {
      const ref = `D${i + 1}`;
      refs.deliverables.set(ref, d.id);
      const meta = [
        `side: ${d.side}`,
        d.owner ? `owner: ${d.owner}` : '',
        d.due ? `due: ${d.due}` : '',
      ]
        .filter(Boolean)
        .join('; ');
      lines.push(`- ${ref} [${d.status ?? 'pending'}]: ${d.item}${meta ? `  (${meta})` : ''}`);
    });
    lines.push('');
  }

  return { prompt: lines.join('\n'), refs };
}

export type SynthesisWithRefs = {
  synthesis: CallSynthesis;
  refs: RefMap;
};

export async function synthesizeCall(input: {
  projectName: string;
  clientName: string;
  callType: string;
  callDate: string;
  transcript: string;
  prior?: PriorBrainContext;
}): Promise<SynthesisWithRefs> {
  const ctx = input.prior ?? {
    open_concerns: [],
    open_deliverables: [],
  };
  const { prompt: refBlock, refs } = buildRefBlocks(ctx);

  const hasPrior = ctx.open_concerns.length + ctx.open_deliverables.length > 0;

  const prompt = `You are a client intelligence assistant at a CRO agency.

You are given a call transcript AND a snapshot of open concerns and open deliverables.
Your job is to extract structured facts:

  1. RESOLVE / COMPLETE existing concerns or deliverables the call closes out (use refs C*, D*).
  2. EXTEND existing items the call updates (status, owner, due, details).
  3. ADD net-new concerns or deliverables the transcript introduces.

DECISIONS and WINS: Output EVERYTHING stated this call as new_decisions / new_wins — append-only.
Never rewrite earlier wins/decisions; each bullet should reflect THIS transcript even if similar wording existed before.

Do NOT duplicate items you're resolving/extending — reference via refs instead.

Return ONLY valid JSON, no commentary, no markdown fences.

Project: ${input.projectName}
Client: ${input.clientName}
Call type: ${input.callType}
Call date: ${input.callDate}

${hasPrior ? `${refBlock}\n` : 'EXISTING OPEN ITEMS: none — first call or backlog empty.\n\n'}Transcript:
${input.transcript}

Return this exact structure:
{
  "call_summary": "2-3 sentence summary of what happened on this call",
  "key_updates": ["...", "..."],
  "attendees_client": ["..."],
  "attendees_internal": ["..."],

  "new_contacts": [{ "name": "", "role": "", "notes": "", "is_approver": false }],

  "resolved_concerns": [{ "ref": "C1", "note": "why it's resolved" }],
  "updated_concerns": [{ "ref": "C1", "new_status": "in-progress", "new_owner": "", "new_blocker_for": "", "change_note": "" }],
  "new_concerns": [{ "concern": "", "owner": "", "blocker_for": "", "status": "open" }],

  "completed_deliverables": [{ "ref": "D1", "note": "" }],
  "updated_deliverables": [{ "ref": "D1", "new_status": "in-progress", "new_details": "", "new_owner": "", "new_due": "", "change_note": "" }],
  "new_our_deliverables": [{ "item": "", "details": "", "status": "pending" }],
  "new_client_deliverables": [{ "item": "", "owner": "", "due": "", "status": "pending" }],

  "new_decisions": ["each discrete decision from THIS call"],
  "new_wins": ["each win or positive outcome from THIS call"]
}

Rules:
- Use refs ONLY from the concern/deliverable lists above.
- Empty arrays are fine.
- Status vocabularies: concerns "open"|"in-progress"|"resolved"; deliverables "pending"|"in-progress"|"blocked"|"done".
- completed_deliverables only when explicit evidence work shipped/is finished.`;

  const raw = await runClaude({ prompt, temperature: 0.1, maxTokens: 6000 });
  const synthesis = parseModelJson<CallSynthesis>(raw, EMPTY);
  return { synthesis: { ...EMPTY, ...synthesis }, refs };
}

export type { RefMap };
