import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  USER_COOKIE_NAME,
  getAllowedDomains,
  isGoogleSsoConfigured,
  readUserSession,
} from '@/lib/google-auth';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  sso_not_configured:
    'Google SSO is not configured on the server. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and NEXTAUTH_URL.',
  missing_code: 'Google did not return an authorization code. Please try again.',
  bad_state: 'Sign-in session expired or was tampered with. Please try again.',
  token_exchange_failed: 'Could not exchange the authorization code with Google. Please try again.',
  invalid_id_token: 'Google returned an invalid identity token. Please try again.',
  email_not_verified: 'Your Google account email is not verified.',
  domain_not_allowed: 'Your Google account is not in an allowed workspace.',
  session_issue_failed: 'Could not start a session. Please contact an administrator.',
  access_denied: 'You declined the Google sign-in.',
};

function safeFrom(value: string | undefined): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { from?: string; error?: string; email?: string; allowed?: string; signedOut?: string };
}) {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(USER_COOKIE_NAME)?.value;
  const session = await readUserSession(sessionToken);
  if (session) {
    redirect(safeFrom(searchParams?.from));
  }

  const configured = isGoogleSsoConfigured();
  const from = safeFrom(searchParams?.from);
  const allowedDomains = getAllowedDomains();

  const error = searchParams?.error;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? 'Sign-in failed. Please try again.' : null;
  const showSignedOut = searchParams?.signedOut === '1' && !error;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-stretch justify-center gap-6 py-10">
      <div className="text-center">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          {BRAND.name}
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">Sign in</h1>
        <p className="mt-1 text-[13px] text-text-muted">
          {allowedDomains.length === 1
            ? `Use your @${allowedDomains[0]} Google Workspace account.`
            : `Use a Google account in: ${allowedDomains.map(d => `@${d}`).join(', ')}.`}
        </p>
      </div>

      {!configured ? (
        <div className="rounded-lg border border-status-yellow/30 bg-status-yellow/5 p-4 text-[12.5px] leading-relaxed text-status-yellow">
          <div className="font-medium">Google SSO is not configured.</div>
          <div className="mt-1 text-text-dim">
            Set{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">
              GOOGLE_CLIENT_ID
            </code>
            ,{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">
              GOOGLE_CLIENT_SECRET
            </code>
            ,{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">
              NEXTAUTH_SECRET
            </code>
            , and{' '}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">
              NEXTAUTH_URL
            </code>{' '}
            in your environment, then reload this page.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface/60 p-5 shadow-card-hover">
          {errorMessage && (
            <div className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-[12.5px] leading-snug text-status-red">
              <div className="font-medium">{errorMessage}</div>
              {error === 'domain_not_allowed' && (
                <div className="mt-1 text-text-dim">
                  {searchParams?.email ? (
                    <>
                      <span className="font-mono">{searchParams.email}</span> is not in the allow-list.
                    </>
                  ) : null}
                  {searchParams?.allowed && (
                    <div className="mt-0.5">
                      Allowed domains:{' '}
                      <span className="font-mono">{searchParams.allowed}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showSignedOut && (
            <div className="rounded-md border border-border bg-surface-2/50 px-3 py-2 text-[12.5px] text-text-dim">
              You have been signed out.
            </div>
          )}

          <Link
            href={`/api/auth/google/start?from=${encodeURIComponent(from)}`}
            className="inline-flex h-10 items-center justify-center gap-2.5 rounded-md border border-border bg-white px-4 text-[13px] font-medium text-[#1f1f1f] transition hover:bg-[#f6f8fc] hover:border-border-strong">
            <GoogleLogo className="h-4 w-4" />
            Continue with Google
          </Link>

          <p className="text-center text-[11.5px] leading-relaxed text-text-muted">
            Only{' '}
            {allowedDomains.map((d, i) => (
              <span key={d} className="font-mono">
                @{d}
                {i < allowedDomains.length - 1 ? ', ' : ''}
              </span>
            ))}{' '}
            Workspace accounts can sign in.
          </p>
        </div>
      )}
    </div>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className={className}>
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
