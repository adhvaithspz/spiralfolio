'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { ProcessingStatus, type ProcessingStep } from './ProcessingStatus';

const inputClass =
  'w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none';

const STEPS: ProcessingStep[] = [
  { key: 'extract', label: 'Extracting call facts…' },
  { key: 'apply', label: 'Updating client brain (contacts, concerns, deliverables)…' },
  { key: 'coaching', label: 'Generating coaching doc (PM/AD only)…' },
  { key: 'integrations', label: 'Posting Slack digest & creating Asana tasks…' },
];

type Result = {
  call_id: string;
  call_summary: string;
  changes_summary: Record<string, number>;
  integrations?: Record<string, unknown>;
};

export function TranscriptUploader({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'form' | 'processing' | 'done'>('form');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const reset = () => {
    setPhase('form');
    setActiveKey(null);
    setError(null);
    setResult(null);
  };

  const onFile = async (file: File, dateInput: HTMLInputElement, transcriptInput: HTMLTextAreaElement) => {
    const text = await file.text();
    transcriptInput.value = text;
    if (!dateInput.value) {
      dateInput.value = new Date(file.lastModified).toISOString().slice(0, 10);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const transcript = String(fd.get('transcript') ?? '').trim();
    const callDate = String(fd.get('callDate') ?? '');
    const callType = String(fd.get('callType') ?? 'weekly');
    if (!transcript) {
      setError('Paste or upload a transcript first.');
      return;
    }

    setPhase('processing');
    setError(null);
    setActiveKey('extract');

    const stepTimer = (() => {
      const order: ProcessingStep['key'][] = ['extract', 'apply', 'coaching', 'integrations'];
      let i = 0;
      const id = setInterval(() => {
        i = Math.min(i + 1, order.length - 1);
        setActiveKey(order[i]);
      }, 4000);
      return id;
    })();

    try {
      const res = await fetch('/api/calls/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          transcript_text: transcript,
          call_date: callDate,
          call_type: callType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Processing failed');
      setResult(data as Result);
      setPhase('done');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPhase('form');
    } finally {
      clearInterval(stepTimer);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={o => {
        setOpen(o);
        if (!o) reset();
      }}>
      <Dialog.Trigger asChild>
        <Button variant="primary" size="md">
          <Upload className="h-3.5 w-3.5" /> Upload Transcript
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-sm font-semibold text-text">
              {phase === 'done' ? 'Processed' : 'Upload Transcript'}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-text">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {phase === 'form' && (
            <form onSubmit={onSubmit} className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Call date</Label>
                  <input type="date" name="callDate" required className={inputClass} id="up-date" />
                </div>
                <div>
                  <Label>Call type</Label>
                  <select name="callType" defaultValue="weekly" className={inputClass}>
                    <option value="kickoff">kickoff</option>
                    <option value="weekly">weekly</option>
                    <option value="ad-hoc">ad-hoc</option>
                    <option value="review">review</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Transcript (.txt or paste)</Label>
                <input
                  type="file"
                  accept=".txt,.vtt,.md"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ta = document.getElementById('up-transcript') as HTMLTextAreaElement;
                    const di = document.getElementById('up-date') as HTMLInputElement;
                    await onFile(file, di, ta);
                  }}
                  className="mb-2 block w-full text-[12px] text-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-text hover:file:bg-border"
                />
                <textarea
                  id="up-transcript"
                  name="transcript"
                  rows={10}
                  placeholder="Paste full transcript here…"
                  className={inputClass + ' font-mono text-[12px] leading-relaxed'}
                />
              </div>
              {error && <div className="text-[12px] text-status-red">{error}</div>}
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button type="submit" variant="primary">
                  Process Call
                </Button>
              </div>
            </form>
          )}

          {phase === 'processing' && (
            <div className="p-4">
              <ProcessingStatus steps={STEPS} activeKey={activeKey ?? 'extract'} />
            </div>
          )}

          {phase === 'done' && result && (
            <div className="space-y-3 p-4">
              <div className="rounded-md border border-status-green/30 bg-status-green/10 p-3 text-[13px] text-text">
                {result.call_summary || 'Call processed successfully.'}
              </div>
              <div>
                <div className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">What changed</div>
                <ul className="grid grid-cols-2 gap-2 text-[12px]">
                  {Object.entries(result.changes_summary).map(([k, v]) => (
                    <li
                      key={k}
                      className="flex items-center justify-between rounded-md border border-border bg-bg px-2.5 py-1.5">
                      <span className="text-text-muted">{k.replace(/_/g, ' ')}</span>
                      <span className="stat-num text-text">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button variant="primary" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">{children}</div>
  );
}
