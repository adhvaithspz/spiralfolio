import 'server-only';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

/**
 * Database connection.
 *
 * Dev  : TURSO_DATABASE_URL=file:./spiralfolio.db  (local SQLite file, no auth)
 * Prod : TURSO_DATABASE_URL=libsql://…  +  TURSO_AUTH_TOKEN=…  (Turso cloud)
 */
const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? 'file:./spiralfolio.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export { schema };
