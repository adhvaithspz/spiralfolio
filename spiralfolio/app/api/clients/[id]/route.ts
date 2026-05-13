import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getClient, getClientBrain, listCallsSafe } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const [client, brain, calls] = await Promise.all([
    getClient(params.id),
    getClientBrain(params.id),
    listCallsSafe(params.id),
  ]);
  if (!client) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ client, brain, calls });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const allowed: Record<string, unknown> = {};
  for (const key of [
    'name',
    'engagement',
    'pmName',
    'adName',
    'status',
    'successMetric',
    'driveFolderUrl',
  ] as const) {
    if (key in body) allowed[key] = body[key];
  }
  allowed.updatedAt = new Date();
  await db.update(clients).set(allowed).where(eq(clients.id, params.id));
  return NextResponse.json({ client: await getClient(params.id) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  // ON DELETE CASCADE handles all child rows.
  await db.delete(clients).where(eq(clients.id, params.id));
  return NextResponse.json({ ok: true });
}
