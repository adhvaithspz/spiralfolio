import { runClaude } from './client';
import { parseModelJson } from '@/lib/utils/json';

export type CallSynthesis = {
  call_summary: string;
  key_updates: string[];
  new_contacts: { name: string; role?: string; notes?: string; is_approver?: boolean }[];
  resolved_concerns: string[];
  new_concerns: { concern: string; owner?: string; blocker_for?: string; status?: string }[];
  new_our_deliverables: { item: string; details?: string; status?: string }[];
  new_client_deliverables: { item: string; owner?: string; due?: string }[];
  updated_deliverables: { item: string; new_status: string }[];
  decisions_made: string[];
  wins: string[];
  attendees_client: string[];
  attendees_internal: string[];
};

const EMPTY: CallSynthesis = {
  call_summary: '',
  key_updates: [],
  new_contacts: [],
  resolved_concerns: [],
  new_concerns: [],
  new_our_deliverables: [],
  new_client_deliverables: [],
  updated_deliverables: [],
  decisions_made: [],
  wins: [],
  attendees_client: [],
  attendees_internal: [],
};

export async function synthesizeCall(input: {
  projectName: string;
  clientName: string;
  callType: string;
  callDate: string;
  transcript: string;
}): Promise<CallSynthesis> {
  const prompt = `You are a client intelligence assistant at a CRO agency.

Extract structured facts from this call transcript. Return ONLY valid JSON, no commentary, no markdown fences.

Project: ${input.projectName}
Client: ${input.clientName}
Call type: ${input.callType}
Call date: ${input.callDate}

Transcript:
${input.transcript}

Return this exact structure:
{
  "call_summary": "2-3 sentence summary of what happened on this call",
  "key_updates": ["...", "..."],
  "new_contacts": [{ "name": "", "role": "", "notes": "", "is_approver": false }],
  "resolved_concerns": ["exact wording of any previously open concerns that were closed"],
  "new_concerns": [{ "concern": "", "owner": "", "blocker_for": "", "status": "" }],
  "new_our_deliverables": [{ "item": "", "details": "", "status": "" }],
  "new_client_deliverables": [{ "item": "", "owner": "", "due": "" }],
  "updated_deliverables": [{ "item": "", "new_status": "" }],
  "decisions_made": ["..."],
  "wins": ["..."],
  "attendees_client": ["..."],
  "attendees_internal": ["..."]
}`;

  const raw = await runClaude({ prompt, temperature: 0.1 });
  return parseModelJson<CallSynthesis>(raw, EMPTY);
}
