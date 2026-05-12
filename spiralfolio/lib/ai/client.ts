import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to .env.local before running AI flows.');
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Run a single-shot completion. Returns the raw text content.
 */
export async function runClaude(opts: {
  prompt: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.2,
    system: opts.system,
    messages: [{ role: 'user', content: opts.prompt }],
  });
  const text = resp.content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();
  return text;
}
