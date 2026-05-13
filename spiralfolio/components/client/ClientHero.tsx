import Link from 'next/link';
import { ChevronLeft, Building2, User2, UserCog, CalendarDays } from 'lucide-react';

import { HealthIndicator } from '@/components/shared/HealthIndicator';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TranscriptUploader } from '@/components/calls/TranscriptUploader';
import { formatDate } from '@/lib/utils';
import type { Client } from '@/lib/db/schema';

const STATUS_TINT: Record<string, string> = {
  'on-track': 'before:bg-[radial-gradient(ellipse_at_top_left,rgba(34,197,94,0.15),transparent_60%)]',
  'at-risk': 'before:bg-[radial-gradient(ellipse_at_top_left,rgba(234,179,8,0.18),transparent_60%)]',
  blocked: 'before:bg-[radial-gradient(ellipse_at_top_left,rgba(239,68,68,0.20),transparent_60%)]',
  complete: 'before:bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.16),transparent_60%)]',
};

const STATUS_ACCENT: Record<string, string> = {
  'on-track': 'from-status-green/60 via-status-green/30 to-transparent',
  'at-risk': 'from-status-yellow/60 via-status-yellow/30 to-transparent',
  blocked: 'from-status-red/60 via-status-red/30 to-transparent',
  complete: 'from-text-muted/40 via-text-muted/20 to-transparent',
};

export function ClientHero({ client, lastCallDate }: { client: Client; lastCallDate: string | null }) {
  const status = client.status ?? 'on-track';

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-border bg-spotlight animate-rise before:pointer-events-none before:absolute before:inset-0 ${STATUS_TINT[status] ?? STATUS_TINT['on-track']}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40" />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${STATUS_ACCENT[status] ?? STATUS_ACCENT['on-track']}`}
      />

      <div className="relative px-6 pt-5 pb-6 lg:px-8 lg:pt-6 lg:pb-7">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[11px] text-text-muted transition hover:text-text">
          <ChevronLeft className="h-3.5 w-3.5" /> All clients
        </Link>

        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <HealthIndicator status={status} size="lg" />
              <h1 className="truncate text-[28px] font-semibold tracking-tight text-text lg:text-[32px]">
                {client.name}
              </h1>
              <StatusBadge status={status} />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-text-dim">
              {client.engagement && <Chip icon={<Building2 className="h-3 w-3" />}>{client.engagement}</Chip>}
              {client.pmName && (
                <Chip icon={<User2 className="h-3 w-3" />} label="PM">
                  {client.pmName}
                </Chip>
              )}
              {client.adName && (
                <Chip icon={<UserCog className="h-3 w-3" />} label="AD">
                  {client.adName}
                </Chip>
              )}
              {lastCallDate && (
                <Chip icon={<CalendarDays className="h-3 w-3" />} label="Last call">
                  {formatDate(lastCallDate)}
                </Chip>
              )}
            </div>
          </div>

          <div className="shrink-0">
            <TranscriptUploader clientId={client.id} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ icon, label, children }: { icon: React.ReactNode; label?: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-2.5 py-1 text-[11.5px] text-text-dim">
      <span className="text-text-muted">{icon}</span>
      {label && <span className="text-text-muted">{label}</span>}
      <span className="text-text">{children}</span>
    </span>
  );
}
