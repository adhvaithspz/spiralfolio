
import { useState } from 'react';
import { Sparkles, Copy, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { apiFetch } from '@/lib/api';

export function QuickBriefing({ clientId, compact = false }: { clientId: string; compact?: boolean }) {
  const [briefing, setBriefing] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/briefing?client_id=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate briefing');
      setBriefing(data.briefing ?? '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onCopy = async () => {
    if (!briefing) return;
    await navigator.clipboard.writeText(briefing);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {!briefing && !loading && (
          <Button variant="primary" size="sm" onClick={fetchBriefing} className="w-full">
            <Sparkles className="h-3.5 w-3.5" /> Get Briefed
          </Button>
        )}
        {loading && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-text-muted">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating briefing…
          </div>
        )}
        {error && <div className="text-[12px] text-status-red">{error}</div>}
        {briefing && (
          <div className="space-y-2 rounded-md border border-border bg-bg p-3">
            <p className="text-[12px] leading-relaxed text-text">{briefing}</p>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={onCopy} variant="secondary">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button size="sm" onClick={fetchBriefing} variant="ghost">
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-text-dim">Quick Briefing</h3>
        </div>
        <div className="flex gap-1">
          {briefing && (
            <Button size="sm" variant="ghost" onClick={onCopy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={fetchBriefing} disabled={loading}>
            <RefreshCw className={'h-3 w-3 ' + (loading ? 'animate-spin' : '')} />
            {briefing ? 'Refresh' : 'Generate'}
          </Button>
        </div>
      </div>
      <div className="p-4">
        {!briefing && !loading && (
          <p className="text-[13px] text-text-muted">
            Click <span className="text-text">Generate</span> for an AI-written briefing of this
            client&rsquo;s current state. The result is plain prose, copy-pasteable into Slack or a meeting
            note.
          </p>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-[13px] text-text-muted">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating briefing…
          </div>
        )}
        {error && <div className="text-[13px] text-status-red">{error}</div>}
        {briefing && <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text">{briefing}</p>}
      </div>
    </div>
  );
}
