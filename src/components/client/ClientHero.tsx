import { Link } from 'react-router-dom';
import { ChevronLeft, Building2, User2, UserCog, CalendarDays } from 'lucide-react';

import { HealthIndicator } from '@/components/shared/HealthIndicator';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { TranscriptUploader } from '@/components/calls/TranscriptUploader';
import { formatDate } from '@/lib/utils';
import type { Client } from '@/lib/types/schema';

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
      className={`relative overflow-hidden rounded-xl border border-border bg-spotlight animate-rise max-lg:rounded-lg 2xl:rounded-2xl before:pointer-events-none before:absolute before:inset-0 ${STATUS_TINT[status] ?? STATUS_TINT['on-track']}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40" />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${STATUS_ACCENT[status] ?? STATUS_ACCENT['on-track']}`}
      />

      <div className="relative px-2.5 pb-2 pt-2 sm:px-5 sm:pb-5 sm:pt-4 lg:px-7 lg:pb-5 lg:pt-5 2xl:px-8 2xl:pb-7 2xl:pt-6 min-[1920px]:px-10 min-[1920px]:pb-8 min-[1920px]:pt-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-[10px] text-text-muted transition hover:text-text sm:text-[11px] min-[1920px]:text-[12px]">
          <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> All clients
        </Link>

        <div className="mt-1.5 flex flex-col gap-1.5 sm:mt-3 sm:gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4 2xl:gap-5 min-[1920px]:gap-6">
          <div className="min-w-0 lg:flex-1">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 min-[1920px]:gap-2.5">
              <HealthIndicator status={status} size="lg" className="max-2xl:scale-90 max-lg:scale-[0.85]" />
              <h1 className="min-w-0 flex-1 basis-[min(100%,12rem)] truncate text-[1.05rem] font-semibold leading-tight tracking-tight text-text sm:text-[1.625rem] lg:basis-auto lg:flex-none lg:text-[1.75rem] 2xl:text-[28px] min-[1920px]:text-[32px]">
                {client.name}
              </h1>
              <span className="shrink-0">
                <StatusBadge status={status} />
              </span>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[9.5px] text-text-dim sm:mt-2 sm:gap-x-3 sm:text-[12px] 2xl:mt-3 2xl:gap-x-5 min-[1920px]:text-[13px]">
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

          <div className="w-full max-w-full shrink-0 sm:w-auto lg:max-w-none lg:shrink-0">
            <TranscriptUploader clientId={client.id} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ icon, label, children }: { icon: React.ReactNode; label?: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/80 px-1.5 py-0.5 text-[9.5px] text-text-dim sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[11.5px] min-[1920px]:px-3 min-[1920px]:text-[13px]">
      <span className="text-text-muted">{icon}</span>
      {label && <span className="text-text-muted">{label}</span>}
      <span className="text-text">{children}</span>
    </span>
  );
}
