'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { Upload, X, CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { toLocalYYYYMMDD } from '@/lib/utils';

const inputClass =
  'w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none';

type Result = {
  call_id: string;
  call_summary: string;
  changes_summary: Record<string, number>;
  integrations?: Record<string, unknown>;
};

function formatDisplay(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TranscriptUploader({ clientId }: { clientId: string }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'form' | 'processing' | 'done'>('form');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const reset = () => {
    submitting.current = false;
    setPhase('form');
    setError(null);
    setResult(null);
    setPdfFile(null);
    setSelectedDate(undefined);
  };

  const onFile = async (file: File, transcriptInput: HTMLTextAreaElement) => {
    if (!selectedDate) {
      setSelectedDate(new Date(file.lastModified));
    }
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setPdfFile(file);
      transcriptInput.value = '';
    } else {
      setPdfFile(null);
      const text = await file.text();
      transcriptInput.value = text;
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting.current) return;

    const fd = new FormData(e.currentTarget);
    const transcript = String(fd.get('transcript') ?? '').trim();
    const callDate = selectedDate ? toLocalYYYYMMDD(selectedDate) : String(fd.get('callDate') ?? '');
    const callType = String(fd.get('callType') ?? 'weekly');

    if (!callDate) {
      setError('Pick a call date first.');
      return;
    }
    if (!pdfFile && !transcript) {
      setError('Upload a PDF or paste a transcript first.');
      return;
    }

    submitting.current = true;
    setPhase('processing');
    setError(null);

    try {
      let res: Response;
      const apiKey = process.env.NEXT_PUBLIC_SPIRALFOLIO_API_KEY ?? '';
      if (pdfFile) {
        const upload = new FormData();
        upload.append('client_id', clientId);
        upload.append('call_date', callDate);
        upload.append('call_type', callType);
        upload.append('file', pdfFile);
        res = await fetch('/api/calls/process', {
          method: 'POST',
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          body: upload,
        });
      } else {
        res = await fetch('/api/calls/process', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            client_id: clientId,
            transcript_text: transcript,
            call_date: callDate,
            call_type: callType,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Processing failed');
      setResult(data as Result);
      setPhase('done');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPhase('form');
      submitting.current = false;
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
        <Button
          variant="primary"
          size="md"
          className="w-full max-lg:h-8 max-lg:gap-1 max-lg:px-2.5 max-lg:text-[11px] max-sm:h-8 max-sm:gap-1 max-sm:px-2.5 max-sm:text-[12px] sm:w-auto lg:h-9 lg:text-[13px]">
          <Upload className="h-3.5 w-3.5 max-lg:h-3 max-lg:w-3 max-sm:h-3 max-sm:w-3" />
          <span className="hidden lg:inline">Upload Transcript</span>
          <span className="lg:hidden">Upload</span>
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
                  <Popover.Root open={calOpen} onOpenChange={setCalOpen}>
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className={
                          inputClass +
                          ' flex items-center gap-2 text-left ' +
                          (!selectedDate ? 'text-text-muted' : '')
                        }>
                        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                        {selectedDate ? formatDisplay(selectedDate) : 'Pick a date'}
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        className="z-[60] rounded-lg border border-border bg-surface p-0 shadow-2xl"
                        onInteractOutside={() => setCalOpen(false)}>
                        <DayPicker
                          mode="single"
                          selected={selectedDate}
                          onSelect={d => {
                            setSelectedDate(d);
                            setCalOpen(false);
                          }}
                          showOutsideDays
                          classNames={{
                            root: 'p-3 select-none',
                            months: 'flex flex-col',
                            month: 'space-y-3',
                            month_caption: 'flex items-center justify-between px-1 mb-1',
                            caption_label: 'text-[13px] font-semibold text-text',
                            nav: 'flex items-center gap-1',
                            button_previous:
                              'flex h-6 w-6 items-center justify-center rounded-md border border-border text-text-muted hover:bg-surface-2 hover:text-text',
                            button_next:
                              'flex h-6 w-6 items-center justify-center rounded-md border border-border text-text-muted hover:bg-surface-2 hover:text-text',
                            month_grid: 'w-full border-collapse',
                            weekdays: 'flex',
                            weekday:
                              'w-8 text-center text-[10px] font-medium uppercase tracking-wider text-text-muted pb-1',
                            week: 'flex mt-1',
                            day: 'h-8 w-8',
                            day_button:
                              'h-8 w-8 rounded-md text-[12px] text-text hover:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-accent',
                            selected: '[&>button]:bg-accent [&>button]:text-white [&>button]:hover:bg-accent',
                            today: '[&>button]:border [&>button]:border-accent/60 [&>button]:text-accent',
                            outside: '[&>button]:text-text-muted/40',
                            disabled: '[&>button]:opacity-30 [&>button]:pointer-events-none',
                          }}
                          components={{
                            Chevron: ({ orientation }) =>
                              orientation === 'left' ? (
                                <ChevronLeft className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              ),
                          }}
                        />
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
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
                <Label>Transcript (PDF, .txt, or paste)</Label>
                <input
                  type="file"
                  accept=".pdf,.txt,.vtt,.md"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ta = document.getElementById('up-transcript') as HTMLTextAreaElement;
                    await onFile(file, ta);
                  }}
                  className="mb-2 block w-full text-[12px] text-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-text hover:file:bg-border"
                />
                {pdfFile ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-[12px] text-text">
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                      PDF
                    </span>
                    <span className="truncate">{pdfFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setPdfFile(null)}
                      className="ml-auto shrink-0 text-text-muted hover:text-text">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <textarea
                    id="up-transcript"
                    name="transcript"
                    rows={10}
                    placeholder="Paste full transcript here…"
                    className={inputClass + ' font-mono text-[12px] leading-relaxed'}
                  />
                )}
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
            <div className="flex flex-col items-center gap-4 px-4 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <div className="text-center">
                <div className="text-[13px] font-medium text-text">Processing transcript…</div>
                <div className="mt-1 text-[12px] text-text-muted">
                  Claude is extracting facts and updating the client brain. This takes 20–40 seconds.
                </div>
              </div>
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
