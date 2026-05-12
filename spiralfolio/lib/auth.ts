import 'server-only';
import { NextResponse } from 'next/server';

/**
 * Simple bearer-token check for machine-to-machine API routes
 * (Apps Script → SpiralFolio).
 *
 * Set SPIRALFOLIO_API_KEY in the environment. If the env var is not set the
 * check is skipped — useful in local dev where Apps Script can't reach localhost.
 *
 * Usage:
 *   const authError = checkApiKey(req);
 *   if (authError) return authError;
 */
export function checkApiKey(req: Request): NextResponse | null {
  const key = process.env.SPIRALFOLIO_API_KEY;
  if (!key) return null; // no key configured → open (local dev)

  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  if (token !== key) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
