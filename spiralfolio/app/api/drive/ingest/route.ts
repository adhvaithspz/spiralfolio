import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clients, documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from '@/lib/utils/nanoid';
import { getClient } from '@/lib/db/queries';
import { safeStringify } from '@/lib/utils/json';
import {
  extractFolderIdFromUrl,
  getFileContent,
  isDriveConfigured,
  listFolderFiles,
} from '@/lib/integrations/drive';
import { extractDocument } from '@/lib/ai/documents';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const clientId = String(body.client_id ?? body.clientId ?? body.project_id ?? body.projectId ?? '');
  const folderUrl = String(body.folder_url ?? body.folderUrl ?? '');
  if (!clientId || !folderUrl) {
    return NextResponse.json({ error: 'client_id and folder_url are required' }, { status: 400 });
  }
  if (!isDriveConfigured()) {
    return NextResponse.json(
      { error: 'Google Drive is not configured (GOOGLE_SERVICE_ACCOUNT_JSON missing)' },
      { status: 400 }
    );
  }
  const folderId = extractFolderIdFromUrl(folderUrl);
  if (!folderId) {
    return NextResponse.json({ error: 'could not parse folder id from url' }, { status: 400 });
  }

  const client = await getClient(clientId);
  if (!client) return NextResponse.json({ error: 'client not found' }, { status: 404 });

  const files = await listFolderFiles(folderId);
  let ingested = 0;
  let flagsFound = 0;
  const docs: { id: string; name: string; type: string; flags: number }[] = [];

  for (const file of files) {
    const content = await getFileContent(file);
    if (content.skipped || !content.text) continue;
    const extraction = await extractDocument({
      filename: file.name,
      projectName: client.engagement ?? client.name,
      clientName: client.name,
      content: content.text.slice(0, 30000),
    });
    flagsFound += extraction.flags.length;
    const docId = nanoid();
    await db.insert(documents).values({
      id: docId,
      clientId,
      name: file.name,
      driveFileId: file.id,
      docType: extraction.type,
      keyFacts: safeStringify(extraction.key_facts),
      flags: safeStringify(extraction.flags),
      ingestedAt: new Date(),
    });
    ingested++;
    docs.push({ id: docId, name: file.name, type: extraction.type, flags: extraction.flags.length });
  }

  await db.update(clients).set({ driveFolderUrl: folderUrl, updatedAt: new Date() }).where(eq(clients.id, clientId));

  return NextResponse.json({ ingested, flags_found: flagsFound, docs });
}
