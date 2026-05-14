/**
 * Google SSO for SpiralFolio.
 *
 * Implements a standalone Authorization Code flow + HMAC-signed session
 * cookie (similar pattern to `lib/admin-auth.ts`). No NextAuth dependency,
 * and all crypto uses Web Crypto so the same module works in both Node
 * (route handlers) and Edge (middleware) runtimes.
 *
 * Access policy: only users whose Google account hosted-domain (`hd` claim
 * on the ID token) AND email suffix are in `ALLOWED_EMAIL_DOMAINS` may sign
 * in. Default allow-list is `spiralyze.com`.
 *
 * Env vars:
 *   GOOGLE_CLIENT_ID         — OAuth client ID (Web application)
 *   GOOGLE_CLIENT_SECRET     — OAuth client secret
 *   NEXTAUTH_SECRET          — 32+ random bytes used to sign session cookies
 *   NEXTAUTH_URL             — Public base URL of this app (e.g. https://app.spiralyze.com)
 *   ALLOWED_EMAIL_DOMAINS    — Comma-separated, optional. Defaults to "spiralyze.com".
 */

export const USER_COOKIE_NAME = 'spiralfolio_user';
export const OAUTH_STATE_COOKIE_NAME = 'spiralfolio_oauth_state';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const OAUTH_STATE_TTL_SECONDS = 60 * 10; // 10 minutes

const DEFAULT_ALLOWED_DOMAINS = ['spiralyze.com'];

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export type GoogleUserSession = {
  email: string;
  name: string;
  picture: string | null;
  sub: string;
  hd: string | null;
  issuedAt: Date;
  expiresAt: Date;
};

type SessionPayload = {
  e: string; // email
  n: string; // name
  p: string | null; // picture
  s: string; // sub (google user id)
  h: string | null; // hd (hosted domain)
  iat: number;
  exp: number;
};

type StatePayload = {
  n: string; // nonce
  r: string; // post-login redirect path
  iat: number;
  exp: number;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function getAllowedDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS?.trim();
  if (!raw) return DEFAULT_ALLOWED_DOMAINS;
  return raw
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);
}

function getSessionSecret(): string | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) return null;
  return secret;
}

function getOAuthConfig():
  | { clientId: string; clientSecret: string; baseUrl: string }
  | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl =
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!clientId || !clientSecret || !baseUrl) return null;
  return { clientId, clientSecret, baseUrl };
}

export function isGoogleSsoConfigured(): boolean {
  return getOAuthConfig() !== null && getSessionSecret() !== null;
}

export function getRedirectUri(): string | null {
  const cfg = getOAuthConfig();
  if (!cfg) return null;
  return `${cfg.baseUrl}/api/auth/google/callback`;
}

// ---------------------------------------------------------------------------
// Base64URL + HMAC (Web Crypto, runs on Edge + Node)
// ---------------------------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin =
    typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bytesToStr(b: Uint8Array): string {
  return new TextDecoder().decode(b);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    strToBytes(secret) as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    strToBytes(data) as unknown as BufferSource,
  );
  return bytesToBase64Url(new Uint8Array(sig));
}

async function hmacVerify(secret: string, data: string, sig: string): Promise<boolean> {
  try {
    const key = await importHmacKey(secret);
    return await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(sig) as unknown as BufferSource,
      strToBytes(data) as unknown as BufferSource,
    );
  } catch {
    return false;
  }
}

async function signPayload<T>(payload: T, secret: string): Promise<string> {
  const body = bytesToBase64Url(strToBytes(JSON.stringify(payload)));
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
}

async function verifyAndDecodePayload<T>(
  token: string,
  secret: string,
): Promise<T | null> {
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!(await hmacVerify(secret, body, sig))) return null;
  try {
    return JSON.parse(bytesToStr(base64UrlToBytes(body))) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// OAuth state (CSRF + post-login redirect)
// ---------------------------------------------------------------------------

function randomNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return bytesToBase64Url(buf);
}

export async function issueOAuthState(redirectTo: string): Promise<string | null> {
  const secret = getSessionSecret();
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: StatePayload = {
    n: randomNonce(),
    r: redirectTo || '/',
    iat: now,
    exp: now + OAUTH_STATE_TTL_SECONDS,
  };
  return signPayload(payload, secret);
}

export async function verifyOAuthState(
  token: string | undefined | null,
): Promise<{ redirectTo: string } | null> {
  if (!token) return null;
  const secret = getSessionSecret();
  if (!secret) return null;
  const decoded = await verifyAndDecodePayload<StatePayload>(token, secret);
  if (!decoded) return null;
  if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
  return { redirectTo: typeof decoded.r === 'string' ? decoded.r : '/' };
}

// ---------------------------------------------------------------------------
// Session cookie
// ---------------------------------------------------------------------------

type IssuedSession = { token: string; expiresAt: Date };

export async function issueUserSession(user: {
  email: string;
  name: string;
  picture: string | null;
  sub: string;
  hd: string | null;
}): Promise<IssuedSession | null> {
  const secret = getSessionSecret();
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    e: user.email,
    n: user.name,
    p: user.picture,
    s: user.sub,
    h: user.hd,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  return {
    token: await signPayload(payload, secret),
    expiresAt: new Date(payload.exp * 1000),
  };
}

export async function readUserSession(
  token: string | undefined | null,
): Promise<GoogleUserSession | null> {
  if (!token) return null;
  const secret = getSessionSecret();
  if (!secret) return null;
  const decoded = await verifyAndDecodePayload<SessionPayload>(token, secret);
  if (!decoded) return null;
  if (typeof decoded.e !== 'string' || typeof decoded.exp !== 'number') return null;
  if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

  if (!isEmailAllowed(decoded.e, decoded.h ?? null)) return null;

  return {
    email: decoded.e,
    name: decoded.n,
    picture: decoded.p,
    sub: decoded.s,
    hd: decoded.h,
    issuedAt: new Date(decoded.iat * 1000),
    expiresAt: new Date(decoded.exp * 1000),
  };
}

// ---------------------------------------------------------------------------
// Domain allow-list
// ---------------------------------------------------------------------------

export function isEmailAllowed(email: string, hd: string | null): boolean {
  const allowed = getAllowedDomains();
  if (allowed.length === 0) return false;
  const lower = email.trim().toLowerCase();
  const atIdx = lower.lastIndexOf('@');
  if (atIdx < 0) return false;
  const emailDomain = lower.slice(atIdx + 1);

  // Both signals must agree on the same allowed domain. The hosted-domain
  // claim from Google means the account is a Google Workspace member of
  // that domain — much stronger than just looking at the email string.
  const matchesEmail = allowed.includes(emailDomain);
  const matchesHd = !!hd && allowed.includes(hd.toLowerCase());
  return matchesEmail && matchesHd;
}

// ---------------------------------------------------------------------------
// Google OAuth: build URL + exchange code
// ---------------------------------------------------------------------------

export function buildGoogleAuthUrl(state: string): string | null {
  const cfg = getOAuthConfig();
  const redirectUri = getRedirectUri();
  if (!cfg || !redirectUri) return null;
  const allowed = getAllowedDomains();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });
  // `hd` is a hint to Google — it filters the account picker to the given
  // workspace. We still verify the hd claim server-side. Only set when
  // exactly one domain is in the allow-list, otherwise omit and rely on
  // server-side checks alone.
  if (allowed.length === 1) params.set('hd', allowed[0]);
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  id_token: string;
  scope: string;
  token_type: string;
  refresh_token?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const cfg = getOAuthConfig();
  const redirectUri = getRedirectUri();
  if (!cfg || !redirectUri) {
    throw new Error('Google OAuth is not configured');
  }
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export type GoogleIdTokenClaims = {
  iss?: string;
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  hd?: string;
  iat?: number;
  exp?: number;
};

/**
 * Decode (without re-validating signature) the claims from an ID token
 * we just received over TLS from Google's token endpoint. Per Google's
 * docs, ID tokens delivered through the back-channel token exchange may
 * be trusted without additional signature validation.
 */
export function decodeIdTokenClaims(idToken: string): GoogleIdTokenClaims | null {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(bytesToStr(base64UrlToBytes(parts[1]))) as GoogleIdTokenClaims;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token revocation (best-effort, used on logout)
// ---------------------------------------------------------------------------

export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
      cache: 'no-store',
    });
  } catch {
    // best-effort; logout still clears the cookie
  }
}
