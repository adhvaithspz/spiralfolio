import { NextResponse } from 'next/server';
import { listClients } from '@/lib/db/queries';
import { checkApiKey } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/clients/lookup?name=TechSmith
 *
 * Finds a client by name with a three-pass strategy:
 *   1. Exact match (case-insensitive)
 *   2. Normalised exact (strip punctuation/spaces)
 *   3. Contains match
 *
 * Used by the Apps Script integration to resolve a client name from the
 * Zoom meeting topic into a SpiralFolio client_id before posting a transcript.
 *
 * Requires Bearer token (SPIRALFOLIO_API_KEY) in Authorization header.
 */
export async function GET(req: Request) {
  const authError = checkApiKey(req);
  if (authError) return authError;

  const name = new URL(req.url).searchParams.get('name')?.trim();
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const needle = name.toLowerCase().replace(/[\s\-_.]+/g, '');
  const all = await listClients();

  // Pass 1: exact
  let match = all.find(c => c.name.toLowerCase() === name.toLowerCase());

  // Pass 2: normalised exact (strip punctuation/spaces)
  if (!match) {
    match = all.find(c => c.name.toLowerCase().replace(/[\s\-_.]+/g, '') === needle);
  }

  // Pass 3: client name contains needle or needle contains client name
  if (!match) {
    match = all.find(c => {
      const cn = c.name.toLowerCase().replace(/[\s\-_.]+/g, '');
      return cn.includes(needle) || needle.includes(cn);
    });
  }

  if (!match) {
    return NextResponse.json({ error: `No client found matching "${name}"` }, { status: 404 });
  }

  return NextResponse.json({ client: { id: match.id, name: match.name, pmName: match.pmName, adName: match.adName } });
}
