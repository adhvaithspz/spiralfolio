import { NextResponse } from 'next/server';
import {
  OAUTH_STATE_COOKIE_NAME,
  buildGoogleAuthUrl,
  isGoogleSsoConfigured,
  issueOAuthState,
} from '@/lib/google-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/google/start?from=/some/path
 *
 * Begins the Google OAuth flow:
 *   - Issues an HMAC-signed `state` value that also carries the post-login
 *     `redirectTo` path (so we don't need a side database).
 *   - Stores it in an httpOnly cookie for CSRF verification.
 *   - 302-redirects the browser to Google's consent screen.
 */
export async function GET(req: Request) {
  if (!isGoogleSsoConfigured()) {
    return NextResponse.json(
      {
        error:
          'Google SSO is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and NEXTAUTH_URL in the environment.',
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const rawFrom = url.searchParams.get('from') ?? '/';
  // Only accept same-origin paths to prevent open-redirect.
  const redirectTo = rawFrom.startsWith('/') && !rawFrom.startsWith('//') ? rawFrom : '/';

  const state = await issueOAuthState(redirectTo);
  if (!state) {
    return NextResponse.json({ error: 'Session secret not configured' }, { status: 503 });
  }

  const authUrl = buildGoogleAuthUrl(state);
  if (!authUrl) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 503 });
  }

  const res = NextResponse.redirect(authUrl, { status: 302 });
  res.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });
  return res;
}
