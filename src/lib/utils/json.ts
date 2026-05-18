/**
 * Safe JSON helpers — never throw, always return something usable (browser bundle).
 */

export function safeParse<T = unknown>(input: string | null | undefined, fallback: T): T {
  if (!input) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

export function safeStringify(input: unknown): string {
  try {
    return JSON.stringify(input);
  } catch {
    return '{}';
  }
}

export function stripFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export function parseModelJson<T = unknown>(raw: string, fallback: T): T {
  return safeParse(stripFences(raw), fallback);
}
