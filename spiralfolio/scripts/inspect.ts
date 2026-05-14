/**
 * One-off inspector — prints exactly what's in the DB that .env.local
 * points at. Useful when "the dashboard says one thing and the Turso
 * download says another" — this confirms the truth from the same URL
 * the app uses.
 *
 *   npm run db:inspect
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL ?? 'file:./spiralfolio.db';
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

const TABLES = [
  'clients',
  'users',
  'goals',
  'contacts',
  'concerns',
  'deliverables',
  'decisions',
  'wins',
  'documents',
  'calls',
  'event_logs',
];

function fmtUrl(): string {
  if (url.startsWith('file:')) return url;
  try {
    const u = new URL(url.replace(/^libsql:/, 'https:'));
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

async function main() {
  console.log('Inspecting DB:', fmtUrl());
  console.log('');

  // List actual tables in the DB (proves we're connected to the right one)
  const list = await client.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`);
  console.log('Tables present:');
  for (const r of list.rows) console.log('  -', r.name);
  console.log('');

  console.log('Row counts:');
  for (const t of TABLES) {
    try {
      const r = await client.execute(`SELECT COUNT(*) AS n FROM ${t};`);
      const row = r.rows[0] as unknown as { n: number | string } | undefined;
      const n = Number(row?.n ?? 0);
      console.log(`  ${t.padEnd(14)} ${n.toLocaleString().padStart(8)}`);
    } catch (err) {
      const msg = (err as { message?: string } | null)?.message ?? '';
      if (/no such table/i.test(msg)) {
        console.log(`  ${t.padEnd(14)}  (missing)`);
      } else {
        throw err;
      }
    }
  }

  console.log('');
  console.log('First 3 calls (if any):');
  try {
    const r = await client.execute(
      `SELECT id, client_id, call_date, call_type, status, created_at FROM calls ORDER BY created_at DESC LIMIT 3;`,
    );
    if (r.rows.length === 0) console.log('  (none)');
    for (const row of r.rows) console.log(' ', row);
  } catch {
    console.log('  (calls table missing)');
  }

  console.log('');
  console.log('First 3 clients:');
  const c = await client.execute(`SELECT id, name, pm_name, ad_name FROM clients LIMIT 3;`);
  for (const row of c.rows) console.log(' ', row);

  client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
