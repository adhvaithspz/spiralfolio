import { NextResponse } from 'next/server';
import { OAUTH_STATE_COOKIE_NAME, USER_COOKIE_NAME } from '@/lib/google-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout
 *
 * Clears the Google SSO session cookie. The client should follow up with
 * a client-side navigation to /login. We accept GET as a convenience so
 * the user can also visit /api/auth/logout directly.
 */
export async function POST(req: Request) {
  return clearAndRespond(req);
}

export async function GET(req: Request) {
  return clearAndRespond(req, true);
}

function clearAndRespond(req: Request, redirectAfter = false): NextResponse {
  const res = redirectAfter
    ? NextResponse.redirect(new URL('/login?signedOut=1', new URL(req.url).origin), { status: 302 })
    : NextResponse.json({ ok: true });

  for (const name of [USER_COOKIE_NAME, OAUTH_STATE_COOKIE_NAME]) {
    res.cookies.set({
      name,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }
  return res;
}
