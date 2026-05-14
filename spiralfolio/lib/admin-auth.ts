import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Tiny single-user admin session for the operations dashboard.
 *
 * - Username/password live in env vars (ADMIN_USERNAME, ADMIN_PASSWORD).
 * - Sessions are stateless: an HMAC-signed cookie carries `{ user, exp }`.
 * - Sessions last 7 days by default.
 * - Verification is constant-time (timingSafeEqual) to avoid trivial
 *   credential / signature timing oracles.
 *
 * If the env vars aren't configured the dashboard is hard-locked
 * (every request looks unauthenticated and login refuses).
 */

export const ADMIN_COOKIE_NAME = 'spiralfolio_admin';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

type SessionPayload = {
  u: string; // username
  iat: number; // issued-at (seconds since epoch)
  exp: number; // expires-at (seconds since epoch)
};

export type AdminSession = {
  username: string;
  expiresAt: Date;
};

function getSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) return null;
  return secret;
}

function getConfiguredCredentials():
  | { username: string; password: string }
  | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

export function isAdminConfigured(): boolean {
  return getSecret() !== null && getConfiguredCredentials() !== null;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

function sign(payload: SessionPayload, secret: string): string {
  const body = base64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = base64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

function verify(token: string, secret: string): SessionPayload | null {
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = base64url(createHmac('sha256', secret).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(body).toString('utf8')) as SessionPayload;
    if (typeof parsed.u !== 'string' || typeof parsed.exp !== 'number') return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Verify a username/password pair against the configured admin credentials.
 * Uses constant-time comparison so we don't leak which field was wrong.
 */
export function checkPassword(username: string, password: string): boolean {
  const creds = getConfiguredCredentials();
  if (!creds) return false;

  const u1 = Buffer.from(username);
  const u2 = Buffer.from(creds.username);
  const p1 = Buffer.from(password);
  const p2 = Buffer.from(creds.password);

  // timingSafeEqual requires equal lengths — short-circuit, but spend roughly
  // equal time either way by always running the comparisons.
  let ok = true;
  if (u1.length !== u2.length) ok = false;
  else if (!timingSafeEqual(u1, u2)) ok = false;
  if (p1.length !== p2.length) ok = false;
  else if (!timingSafeEqual(p1, p2)) ok = false;
  return ok;
}

/**
 * Build a signed session token for a freshly-authenticated user.
 * Returns null if the secret isn't configured.
 */
export function issueSessionToken(username: string): { token: string; expiresAt: Date } | null {
  const secret = getSecret();
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    u: username,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  return {
    token: sign(payload, secret),
    expiresAt: new Date(payload.exp * 1000),
  };
}

/**
 * Decode a token from the admin session cookie. Returns null if invalid,
 * expired, missing, or if the server isn't configured.
 */
export function readSessionFromCookie(token: string | undefined | null): AdminSession | null {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;
  const decoded = verify(token, secret);
  if (!decoded) return null;
  return { username: decoded.u, expiresAt: new Date(decoded.exp * 1000) };
}

/**
 * Server-component / server-action helper: read the current session straight
 * from the request cookie jar. Returns null when not signed in.
 */
export function getAdminSession(): AdminSession | null {
  try {
    const c = cookies().get(ADMIN_COOKIE_NAME)?.value;
    return readSessionFromCookie(c);
  } catch {
    return null;
  }
}

export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
