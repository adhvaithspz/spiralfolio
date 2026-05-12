import { runClaude } from './client';

/**
 * PM-gated only. Output of this function is stored in calls.coaching_doc and
 * MUST never be returned to stakeholder or admin roles.
 */
export async function generateCoaching(transcript: string): Promise<string> {
  const prompt = `You are a senior account coach reviewing a client call recording transcript.

Analyze this call for the PM's private development:
- Communication clarity and pacing
- How well goals and next steps were established
- Client engagement signals
- Areas where the PM handled things well
- 1-2 specific suggestions for the next call

This is private feedback for the PM only. Be specific, constructive, and direct.
Do not include scores, ratings, or performance metrics of any kind.

Transcript:
${transcript}`;

  return runClaude({ prompt, temperature: 0.4, maxTokens: 2048 });
}
