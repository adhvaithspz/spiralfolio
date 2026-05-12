import { runClaude } from './client';
import { parseModelJson } from '@/lib/utils/json';

export type DocumentExtraction = {
  type: 'contract' | 'brief' | 'audit' | 'deck' | 'other' | string;
  key_facts: string[];
  flags: string[];
};

const EMPTY: DocumentExtraction = { type: 'other', key_facts: [], flags: [] };

export async function extractDocument(input: {
  filename: string;
  projectName: string;
  clientName: string;
  content: string;
}): Promise<DocumentExtraction> {
  const prompt = `You are extracting project-relevant facts from a client document.

Document name: ${input.filename}
Project: ${input.projectName}
Client: ${input.clientName}

Document content:
${input.content}

Extract only facts a PM or AD would need when working this account:
- Stated goals, KPIs, or success criteria
- Timeline commitments or deadlines
- Budget signals or constraints
- Named stakeholders and their roles
- Technical constraints or requirements
- Anything that could become a concern or conflict later

Return ONLY valid JSON, no commentary:
{ "type": "contract|brief|audit|deck|other", "key_facts": ["..."], "flags": ["..."] }

Flags = facts that might conflict with other known information about this project.
Each fact must be under 20 words. Maximum 10 facts. Return ONLY valid JSON.`;

  const raw = await runClaude({ prompt, temperature: 0.1 });
  return parseModelJson<DocumentExtraction>(raw, EMPTY);
}
