'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Brain,
  ChevronRight,
  CircleDot,
  CloudCog,
  ExternalLink,
  FileText,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
  Slash,
  Upload,
  Video,
  XCircle,
} from 'lucide-react';
import type { EventLog, EventSeverity, EventSource } from '@/lib/db/schema';
import { formatDate, relativeTime } from '@/lib/utils';
import { safeParse } from '@/lib/utils/json';

const SEVERITY_STYLES: Record<EventSeverity, { dot: string; chip: string; icon: React.ReactNode }> = {
  success: {
    dot: 'bg-status-green ring-status-green/25',
    chip: 'bg-status-green/10 text-status-green border-status-green/30',
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  info: {
    dot: 'bg-status-blue ring-status-blue/25',
    chip: 'bg-status-blue/10 text-status-blue border-status-blue/30',
    icon: <CircleDot className="h-3 w-3" />,
  },
  warning: {
    dot: 'bg-status-yellow ring-status-yellow/25',
    chip: 'bg-status-yellow/10 text-status-yellow border-status-yellow/30',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  error: {
    dot: 'bg-status-red ring-status-red/25',
    chip: 'bg-status-red/10 text-status-red border-status-red/30',
    icon: <XCircle className="h-3 w-3" />,
  },
};

const SOURCE_STYLES: Record<EventSource, string> = {
  cloudflare: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  appscript: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  spiralfolio: 'border-accent/30 bg-accent-soft text-accent',
  manual: 'border-border-strong bg-surface-2 text-text-dim',
};

function eventIcon(type: string) {
  if (type.startsWith('cloudflare')) return <CloudCog className="h-4 w-4 text-orange-400" />;
  if (type.startsWith('zoom')) return <Video className="h-4 w-4 text-status-blue" />;
  if (type.startsWith('slack_dm_sent')) return <MailCheck className="h-4 w-4 text-status-green" />;
  if (type.startsWith('slack_dm_skipped')) return <Slash className="h-4 w-4 text-text-muted" />;
  if (type.startsWith('slack_dm_failed')) return <XCircle className="h-4 w-4 text-status-red" />;
  if (type === 'coaching_doc_created') return <FileText className="h-4 w-4 text-status-blue" />;
  if (type === 'transcript_uploaded') return <Upload className="h-4 w-4 text-status-blue" />;
  if (type === 'call_imported') return <ShieldCheck className="h-4 w-4 text-status-green" />;
  if (type === 'brain_changed') return <Brain className="h-4 w-4 text-accent" />;
  if (type.endsWith('_error')) return <ShieldAlert className="h-4 w-4 text-status-red" />;
  return <CircleDot className="h-4 w-4 text-text-muted" />;
}

function prettyType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function EventRow({ row }: { row: EventLog }) {
  const [open, setOpen] = React.useState(false);
  const sev = SEVERITY_STYLES[(row.severity ?? 'info') as EventSeverity] ?? SEVERITY_STYLES.info;
  const src = SOURCE_STYLES[(row.source ?? 'spiralfolio') as EventSource] ?? SOURCE_STYLES.spiralfolio;

  const created = typeof row.createdAt === 'string' ? new Date(row.createdAt) : row.createdAt;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="grid w-full grid-cols-[150px_minmax(0,2fr)_minmax(0,1fr)_120px_120px] items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60">
        <div>
          <div className="stat-num text-[12px] text-text">{relativeTime(created)}</div>
          <div className="stat-num text-[10.5px] text-text-muted">
            {created.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 shrink-0">{eventIcon(row.eventType)}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-medium text-text">
                {prettyType(row.eventType)}
              </span>
              <ChevronRight
                className={
                  'h-3.5 w-3.5 shrink-0 text-text-muted transition ' + (open ? 'rotate-90' : '')
                }
              />
            </div>
            {row.message && (
              <div className="mt-0.5 line-clamp-2 text-[12px] text-text-muted">{row.message}</div>
            )}
            <RowQuickFacts row={row} />
          </div>
        </div>

        <div className="min-w-0">
          {row.clientName && (
            <div className="truncate text-[12.5px] text-text">{row.clientName}</div>
          )}
          {row.meetingTopic && (
            <div className="truncate text-[11.5px] text-text-muted">{row.meetingTopic}</div>
          )}
          {row.callDate && (
            <div className="text-[10.5px] text-text-muted">{formatDate(row.callDate)}</div>
          )}
        </div>

        <div>
          <span
            className={
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ' +
              src
            }>
            {row.source}
          </span>
        </div>

        <div className="text-right">
          <span
            className={
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ' +
              sev.chip
            }>
            {sev.icon}
            {row.severity}
          </span>
        </div>
      </button>

      {open && <RowDetails row={row} />}
    </li>
  );
}

function RowQuickFacts({ row }: { row: EventLog }) {
  const bits: React.ReactNode[] = [];

  if (row.slackRecipient) {
    bits.push(
      <span key="slack" className="inline-flex items-center gap-1">
        <MailCheck className="h-3 w-3" />
        DM&nbsp;to <span className="text-text">{row.slackRecipient}</span>
        {row.slackRecipientEmail && (
          <span className="text-text-muted">({row.slackRecipientEmail})</span>
        )}
      </span>,
    );
  }
  if (row.docUrl) {
    bits.push(
      <a
        key="doc"
        href={row.docUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-accent hover:underline">
        <FileText className="h-3 w-3" />
        Coaching doc
        <ExternalLink className="h-2.5 w-2.5" />
      </a>,
    );
  }
  if (row.callId) {
    bits.push(
      <Link
        key="call"
        href={`/clients/${row.clientId}/calls`}
        onClick={e => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-text-dim hover:text-text">
        Call&nbsp;<span className="font-mono text-text-muted">{row.callId.slice(0, 8)}</span>
      </Link>,
    );
  }

  if (bits.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-dim">
      {bits}
    </div>
  );
}

function RowDetails({ row }: { row: EventLog }) {
  const payload = row.payload ? safeParse<unknown>(row.payload, null) : null;

  return (
    <div className="border-t border-border bg-bg/40 px-4 py-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <KeyValueGrid
          rows={[
            ['Event ID', <span key="id" className="font-mono text-[11px]">{row.id}</span>],
            ['Event type', <span key="t" className="font-mono text-[11px]">{row.eventType}</span>],
            ['Source', row.source],
            ['Severity', row.severity],
            ['Client ID', row.clientId ?? '—'],
            ['Client name', row.clientName ?? '—'],
            ['Meeting topic', row.meetingTopic ?? '—'],
            ['Meeting ID', row.meetingId ?? '—'],
            ['Call ID', row.callId ?? '—'],
            ['Call date', row.callDate ?? '—'],
          ]}
        />
        <KeyValueGrid
          rows={[
            ['Doc URL', row.docUrl ? (
              <a
                key="docu"
                href={row.docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-accent hover:underline">
                {row.docUrl}
              </a>
            ) : '—'],
            ['Slack recipient', row.slackRecipient ?? '—'],
            ['Slack email', row.slackRecipientEmail ?? '—'],
            ['Slack channel', row.slackChannelId ?? '—'],
            ['Slack ts', row.slackTs ?? '—'],
          ]}
        />
      </div>

      {row.slackMessage && (
        <Section title="Slack message">
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface px-3 py-2 font-mono text-[11.5px] leading-relaxed text-text-dim">
            {row.slackMessage}
          </pre>
        </Section>
      )}

      {payload !== null && (
        <Section title="Payload">
          <pre className="max-h-72 overflow-auto rounded-md border border-border bg-surface px-3 py-2 font-mono text-[11.5px] leading-relaxed text-text-dim">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </Section>
      )}
    </div>
  );
}

function KeyValueGrid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-[11.5px]">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-text-muted">{k}</dt>
          <dd className="break-words text-text">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {title}
      </div>
      {children}
    </div>
  );
}
