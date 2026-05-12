import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clients, icpProfile } from '@/lib/db/schema';
import { listClients } from '@/lib/db/queries';
import { nanoid } from '@/lib/utils/nanoid';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ clients: listClients() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const now = new Date();
  const row = {
    id: nanoid(),
    name,
    engagement: body.engagement ?? null,
    pmName: body.pmName ?? body.pm_name ?? null,
    adName: body.adName ?? body.ad_name ?? null,
    status: body.status ?? 'on-track',
    successMetric: body.successMetric ?? body.success_metric ?? null,
    slackChannelId: body.slackChannelId ?? body.slack_channel_id ?? null,
    asanaProjectId: body.asanaProjectId ?? body.asana_project_id ?? null,
    driveFolderUrl: body.driveFolderUrl ?? body.drive_folder_url ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(clients).values(row).run();

  // Create empty ICP profile so the per-client ICP page has a row to update later.
  db.insert(icpProfile)
    .values({
      clientId: row.id,
      primarySegment: null,
      secondarySegment: null,
      motivators: '[]',
      objections: '[]',
      demographicSignals: '[]',
      updatedAt: now,
    })
    .run();

  return NextResponse.json({ client: row }, { status: 201 });
}
