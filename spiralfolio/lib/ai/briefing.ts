import { runClaude } from './client';
import type { ClientBrain } from '@/lib/db/brain';

export async function generateBriefing(brain: ClientBrain): Promise<string> {
  const prompt = `You are briefing a stakeholder who needs a quick update on a client engagement.

Client brain:
${JSON.stringify(brain, null, 2)}

Write a 5-7 sentence plain English briefing covering:
1. What this client engagement is and where we currently stand
2. The 1-2 most important open concerns or blockers right now
3. What we owe the client at the moment
4. What the client owes us
5. One thing worth knowing about the client relationship or dynamics

Tone: direct and clear, like a senior PM briefing a colleague before a meeting. No bullet points. No headers. Plain prose only.`;

  return runClaude({ prompt, temperature: 0.4, maxTokens: 1024 });
}
