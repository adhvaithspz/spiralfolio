'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/shared/Button';

const inputClass =
  'w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:border-accent focus:outline-none';

export function NewClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
          name: fd.get('name'),
          engagement: fd.get('engagement') || null,
          pmName: fd.get('pmName') || null,
          adName: fd.get('adName') || null,
          status: fd.get('status') || 'on-track',
          successMetric: fd.get('successMetric') || null,
          driveFolderUrl: fd.get('driveFolderUrl') || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create client');
      setOpen(false);
      router.refresh();
      router.push(`/clients/${data.client.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="primary"
          size="md"
          className="max-sm:h-8 max-sm:gap-1 max-sm:px-2.5 max-sm:text-[12px]">
          <Plus className="h-3.5 w-3.5 max-sm:h-3 max-sm:w-3" /> New Client
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-sm font-semibold text-text">New Client</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-text">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <form onSubmit={onSubmit} className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client Name *" name="name" required placeholder="e.g. 32Auctions" />
              <Field label="Engagement" name="engagement" placeholder="e.g. CRO Pilot" />
              <Field label="PM Name" name="pmName" />
              <Field label="AD Name" name="adName" />
              <div>
                <Label>Status</Label>
                <select name="status" defaultValue="on-track" className={inputClass}>
                  <option value="on-track">on-track</option>
                  <option value="at-risk">at-risk</option>
                  <option value="blocked">blocked</option>
                  <option value="complete">complete</option>
                </select>
              </div>
              <Field label="Success Metric" name="successMetric" />
              <Field
                label="Drive Folder URL"
                name="driveFolderUrl"
                placeholder="https://drive.google.com/drive/folders/..."
              />
            </div>
            {error && <div className="text-[12px] text-status-red">{error}</div>}
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create Client'}
              </Button>
            </div>
          </form>
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

function Field({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="col-span-1">
      <Label>{label}</Label>
      <input name={name} placeholder={placeholder} required={required} className={inputClass} />
    </div>
  );
}
