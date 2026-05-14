import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  SESSION_TTL_MS,
  checkPassword,
  isAdminConfigured,
  issueSessionToken,
} from '@/lib/admin-auth';
import { logEvent } from '@/lib/db/events';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          'Admin dashboard is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET in the environment.',
      },
      { status: 503 },
    );
  }

  let username = '';
  let password = '';
  try {
    const body = await req.json();
    username = String(body?.username ?? '').trim();
    password = String(body?.password ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }

  if (!checkPassword(username, password)) {
    await logEvent({
      eventType: 'admin_login_failed',
      severity: 'warning',
      source: 'spiralfolio',
      message: `Failed admin login attempt for username "${username}"`,
      payload: {
        userAgent: req.headers.get('user-agent') ?? null,
      },
    });
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const issued = issueSessionToken(username);
  if (!issued) {
    return NextResponse.json({ error: 'Session secret not configured' }, { status: 503 });
  }

  await logEvent({
    eventType: 'admin_login_succeeded',
    severity: 'success',
    source: 'spiralfolio',
    message: `Admin "${username}" signed in`,
  });

  const res = NextResponse.json({ ok: true, username, expiresAt: issued.expiresAt.toISOString() });
  res.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: issued.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
