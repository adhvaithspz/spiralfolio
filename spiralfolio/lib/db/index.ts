import 'server-only';
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

/**
 * Database connection.
 *
 * Dev  : TURSO_DATABASE_URL=file:./spiralfolio.db  (local SQLite file, no auth)
 * Prod : TURSO_DATABASE_URL=https://…  +  TURSO_AUTH_TOKEN=…  (Turso cloud)
 *
 * Uses @libsql/client/http to force HTTP transport — avoids WebSocket
 * bundling issues with Next.js webpack.
 */
const rawUrl = process.env.TURSO_DATABASE_URL ?? 'file:./spiralfolio.db';
// Normalise libsql:// → https:// so the HTTP client can handle Turso URLs.
const url = rawUrl.startsWith('libsql://') ? rawUrl.replace('libsql://', 'https://') : rawUrl;

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export { schema };
