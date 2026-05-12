import 'server-only';
import { google, type drive_v3 } from 'googleapis';

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
};

export type DriveContent = {
  file: DriveFile;
  text: string;
  skipped?: boolean;
  reason?: string;
};

function getDrive(): drive_v3.Drive | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  let creds: Record<string, unknown>;
  try {
    creds = JSON.parse(raw);
  } catch {
    return null;
  }
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return google.drive({ version: 'v3', auth });
}

export function extractFolderIdFromUrl(url: string): string | null {
  const m1 = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) return url.trim();
  return null;
}

export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const drive = getDrive();
  if (!drive) return [];
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 200,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name && f.mimeType) out.push({ id: f.id, name: f.name, mimeType: f.mimeType });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

async function exportText(drive: drive_v3.Drive, fileId: string, mime: string): Promise<string> {
  const res = await drive.files.export({ fileId, mimeType: mime }, { responseType: 'text' });
  return typeof res.data === 'string' ? res.data : String(res.data ?? '');
}

async function downloadBuffer(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
  return Buffer.from(res.data as ArrayBuffer);
}

/**
 * Resolve text content for a Drive file based on MIME type.
 * Images are skipped (per spec). Unknown types are skipped with a reason.
 */
export async function getFileContent(file: DriveFile): Promise<DriveContent> {
  const drive = getDrive();
  if (!drive) return { file, text: '', skipped: true, reason: 'Drive not configured' };

  try {
    if (file.mimeType === 'application/vnd.google-apps.document') {
      return { file, text: await exportText(drive, file.id, 'text/plain') };
    }
    if (file.mimeType === 'application/vnd.google-apps.presentation') {
      return { file, text: await exportText(drive, file.id, 'text/plain') };
    }
    if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      return { file, text: await exportText(drive, file.id, 'text/csv') };
    }
    if (file.mimeType === 'application/pdf') {
      const buf = await downloadBuffer(drive, file.id);
      const pdfParse = (await import('pdf-parse')).default;
      const { text } = await pdfParse(buf);
      return { file, text };
    }
    if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const buf = await downloadBuffer(drive, file.id);
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return { file, text: value };
    }
    if (file.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      // PPTX — best-effort: return empty text rather than pulling another heavy dep by default.
      return { file, text: '', skipped: true, reason: 'PPTX parsing not implemented in this build' };
    }
    if (file.mimeType.startsWith('image/')) {
      return { file, text: '', skipped: true, reason: 'image (skipped per spec)' };
    }
    return { file, text: '', skipped: true, reason: `unsupported mime: ${file.mimeType}` };
  } catch (err) {
    return { file, text: '', skipped: true, reason: (err as Error).message };
  }
}

export function isDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}
