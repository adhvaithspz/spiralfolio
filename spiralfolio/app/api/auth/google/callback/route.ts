import { NextResponse } from 'next/server';
import {
  OAUTH_STATE_COOKIE_NAME,
  SESSION_TTL_MS,
  USER_COOKIE_NAME,
  decodeIdTokenClaims,
  exchangeCodeForTokens,
  getAllowedDomains,
  isEmailAllowed,
  isGoogleSsoConfigured,
  issueUserSession,
  verifyOAuthState,
} from '@/lib/google-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/google/callback?code=...&state=...
 *
 * Google redirects back here after the user consents. We:
 *   1. Verify the `state` cookie (CSRF) and recover the post-login path.
 *   2. Exchange the auth code for an ID token over TLS.
 *   3. Parse the ID token claims (trusted, since they arrived back-channel).
 *   4. Enforce the email-verified + Workspace-domain (`hd`) allow-list.
 *   5. Issue an HMAC-signed session cookie and redirect to the original URL.
 *
 * On any failure we bounce back to `/login?error=...` with a safe message.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  if (!isGoogleSsoConfigured()) {
    return redirectToLogin(url, 'sso_not_configured');
  }

  const googleError = url.searchParams.get('error');
  if (googleError) {
    return redirectToLogin(url, googleError);
  }

  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  if (!code || !stateParam) {
    return redirectToLogin(url, 'missing_code');
  }

  const stateCookie = readCookie(req, OAUTH_STATE_COOKIE_NAME);
  if (!stateCookie || stateCookie !== stateParam) {
    return redirectToLogin(url, 'bad_state');
  }

  const stateData = await verifyOAuthState(stateParam);
  if (!stateData) {
    return redirectToLogin(url, 'bad_state');
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch {
    return redirectToLogin(url, 'token_exchange_failed');
  }

  const claims = decodeIdTokenClaims(tokens.id_token);
  if (!claims || !claims.email || !claims.sub) {
    return redirectToLogin(url, 'invalid_id_token');
  }
  if (claims.email_verified === false) {
    return redirectToLogin(url, 'email_not_verified');
  }

  const allowed = isEmailAllowed(claims.email, claims.hd ?? null);
  if (!allowed) {
    const domains = getAllowedDomains().join(', ');
    return redirectToLogin(url, 'domain_not_allowed', {
      email: claims.email,
      allowed: domains,
    });
  }

  const issued = await issueUserSession({
    email: claims.email,
    name: claims.name ?? claims.email.split('@')[0],
    picture: claims.picture ?? null,
    sub: claims.sub,
    hd: claims.hd ?? null,
  });
  if (!issued) {
    return redirectToLogin(url, 'session_issue_failed');
  }

  const target = new URL(stateData.redirectTo || '/', url.origin);
  const res = NextResponse.redirect(target, { status: 302 });
  res.cookies.set({
    name: USER_COOKIE_NAME,
    value: issued.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  res.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

function redirectToLogin(
  origin: URL,
  reason: string,
  extras?: Record<string, string>,
): NextResponse {
  const target = new URL('/login', origin.origin);
  target.searchParams.set('error', reason);
  if (extras) {
    for (const [k, v] of Object.entries(extras)) target.searchParams.set(k, v);
  }
  return NextResponse.redirect(target, { status: 302 });
}
