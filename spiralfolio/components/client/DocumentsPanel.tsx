'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tooltip } from '@/components/shared/Tooltip';
import { AlertTriangle, FolderSync } from 'lucide-react';
import type { BrainDocumentRef } from '@/lib/db/brain';

export function DocumentsPanel({
  clientId,
  initialFolderUrl,
  documents,
}: {
  clientId: string;
  initialFolderUrl: string | null;
  documents: BrainDocumentRef[];
}) {
  const router = useRouter();
  const [folderUrl, setFolderUrl] = useState(initialFolderUrl ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ingested: number; flags_found: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSync = async () => {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/drive/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, folder_url: folderUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to ingest folder');
      setResult({ ingested: data.ingested, flags_found: data.flags_found });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <Card className="shrink-0">
        <CardHeader>
          <CardTitle>Drive Folder</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-center gap-2">
          <input
            value={folderUrl}
            onChange={e => setFolderUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="h-9 min-w-[280px] flex-1 rounded-md border border-border bg-bg px-3 text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <Button variant="primary" onClick={onSync} disabled={submitting || !folderUrl}>
            <FolderSync className="h-3.5 w-3.5" />
            {submitting ? 'Syncing…' : 'Sync Drive Folder'}
          </Button>
          {result && (
            <div className="text-[12px] text-text-muted">
              Ingested <span className="text-text">{result.ingested}</span> docs ·{' '}
              <span className="text-status-yellow">{result.flags_found}</span> flags
            </div>
          )}
          {error && <div className="text-[12px] text-status-red">{error}</div>}
        </CardBody>
      </Card>

      {documents.length === 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmptyState
            title="No documents ingested yet."
            description="Paste a Drive folder URL above and sync to extract project-relevant facts."
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
          {documents.map((d, i) => (
            <Card key={d.id ?? `${d.name}-${i}`}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{d.name}</CardTitle>
                  {d.type && (
                    <Tooltip content="Category the model assigned when this file was ingested (contract, brief, audit, deck, etc.).">
                      <span className="inline-flex cursor-help rounded-full border border-border bg-bg px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-text-dim">
                        {d.type}
                      </span>
                    </Tooltip>
                  )}
                </div>
                {!!d.flags?.length && (
                  <Tooltip content="Facts from this document that may contradict other sources in the brain — review before relying on them.">
                    <span className="inline-flex cursor-help items-center gap-1 text-[10px] uppercase tracking-wider text-status-yellow">
                      <AlertTriangle className="h-3 w-3" />
                      {d.flags.length} flag{d.flags.length === 1 ? '' : 's'}
                    </span>
                  </Tooltip>
                )}
              </CardHeader>
              <CardBody className="space-y-3 text-[13px]">
                {!!d.key_facts?.length && (
                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">Key facts</div>
                    <ul className="list-disc space-y-0.5 pl-5 text-text">
                      {d.key_facts.map((k, idx) => (
                        <li key={idx}>{k}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!d.flags?.length && (
                  <div className="rounded-md border border-status-yellow/30 bg-status-yellow/5 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-status-yellow">
                      <AlertTriangle className="h-3 w-3" /> Potential conflicts
                    </div>
                    <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-text">
                      {d.flags.map((f, idx) => (
                        <li key={idx}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
