import { NextResponse, type NextRequest } from 'next/server';
import {
  USER_COOKIE_NAME,
  isGoogleSsoConfigured,
  readUserSession,
} from '@/lib/google-auth';

/**
 * Global SSO gate.
 *
 * Policy:
 *   - When Google SSO is configured (NEXTAUTH_SECRET + GOOGLE_CLIENT_ID/SECRET
 *     + NEXTAUTH_URL all set), every request to a non-public path must
 *     either carry a valid signed session cookie OR (for /api/*) the
 *     SpiralFolio API key bearer token.
 *   - When SSO is NOT configured, the middleware falls back to allow-all
 *     so local development keeps working without OAuth setup. The /login
 *     page surfaces the missing configuration to the operator.
 *
 * Public paths (never gated):
 *   - /login                  — the sign-in screen itself
 *   - /api/auth/*             — Google OAuth start/callback + logout
 *   - /_next/*, /favicon.ico, icon files, robots.txt
 */

const PUBLIC_FILE_RE = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?|ttf|map)$/i;

function isPublicPath(pathname: string): boolean {
  if (pathname === '/login') return true;
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname === '/favicon.ico') return true;
  if (pathname === '/robots.txt') return true;
  if (pathname === '/icon.svg' || pathname === '/apple-icon') return true;
  if (PUBLIC_FILE_RE.test(pathname)) return true;
  return false;
}

function hasApiBearerToken(req: NextRequest): boolean {
  const key = process.env.SPIRALFOLIO_API_KEY;
  if (!key) return false;
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  return token === key;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith('/api/');

  // Apps Script (and any other M2M caller) uses the SPIRALFOLIO_API_KEY
  // bearer token. This check runs BEFORE the SSO gate so the integration
  // keeps working even before Google SSO is configured — Google SSO is
  // for browser sessions only.
  if (isApi && hasApiBearerToken(req)) {
    return NextResponse.next();
  }

  if (!isGoogleSsoConfigured()) {
    // In production, missing SSO config must NEVER fail open for browser
    // routes — that would expose the whole app. Block everything (except
    // the M2M API calls above) with a clear message until the operator
    // wires up env vars. In dev, allow through so the app is still usable
    // before you've set up OAuth.
    if (process.env.NODE_ENV === 'production') {
      if (isApi) {
        return NextResponse.json(
          { error: 'Google SSO is not configured on this deployment.' },
          { status: 503 },
        );
      }
      return new NextResponse(
        'Google SSO is not configured on this deployment. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and NEXTAUTH_URL in the Vercel project settings and redeploy.',
        { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
      );
    }
    return NextResponse.next();
  }

  const sessionToken = req.cookies.get(USER_COOKIE_NAME)?.value;
  const session = await readUserSession(sessionToken);
  if (session) {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?from=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Match every path except the obvious static assets so we don't pay the
  // middleware cost for image/font/JS chunk requests.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
