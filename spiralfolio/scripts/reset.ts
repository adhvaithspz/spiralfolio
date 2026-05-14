/**
 * Reset script — wipes operational tables but keeps the client roster
 * (`clients`) and the team roster (`users`, i.e. PMs/ADs/leadership).
 *
 * What gets WIPED:
 *   - event_logs   (admin event log)
 *   - calls        (per-call rows + transcripts + brain snapshots)
 *   - documents    (extracted document index)
 *   - wins         (call-derived)
 *   - decisions    (call-derived)
 *   - deliverables (call-derived, both sides)
 *   - concerns     (call-derived)
 *   - contacts     (call-derived client-side contacts)
 *   - goals        (per-client goals)
 *
 * What is PRESERVED:
 *   - clients (id, name, engagement, pm_name, ad_name, status, drive_folder_url)
 *   - users   (PM / AD / leadership roster)
 *
 * Usage:
 *   npm run db:reset -- --yes
 *
 * To target a specific environment:
 *   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run db:reset -- --yes
 *
 * This script intentionally requires an explicit `--yes` flag to prevent
 * accidental data loss. Without it, the script does a dry run and prints
 * the row counts that would be deleted.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import {
  calls,
  clients,
  concerns,
  contacts,
  decisions,
  deliverables,
  documents,
  eventLogs,
  goals,
  users,
  wins,
} from '../lib/db/schema';

const args = process.argv.slice(2);
const CONFIRMED = args.includes('--yes') || args.includes('-y');

const url = process.env.TURSO_DATABASE_URL ?? 'file:./spiralfolio.db';
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const db = drizzle(client);

const TABLES_TO_WIPE = [
  { name: 'event_logs', table: eventLogs },
  { name: 'calls', table: calls },
  { name: 'documents', table: documents },
  { name: 'wins', table: wins },
  { name: 'decisions', table: decisions },
  { name: 'deliverables', table: deliverables },
  { name: 'concerns', table: concerns },
  { name: 'contacts', table: contacts },
  { name: 'goals', table: goals },
] as const;

const TABLES_TO_PRESERVE = [
  { name: 'clients', table: clients },
  { name: 'users', table: users },
] as const;

function isMissingTableError(err: unknown): boolean {
  const msg = (err as { message?: string; cause?: { message?: string } } | null)?.message ?? '';
  const cause = (err as { cause?: { message?: string } } | null)?.cause?.message ?? '';
  return /no such table/i.test(msg) || /no such table/i.test(cause);
}

type TableEntry = { name: string; table: unknown };

async function countRows(table: TableEntry): Promise<number | null> {
  try {
    const result = (await db
      .select({ n: sql<number>`count(*)` })
      .from(table.table as never)) as Array<{ n: number }>;
    return Number(result[0]?.n ?? 0);
  } catch (err) {
    if (isMissingTableError(err)) return null;
    throw err;
  }
}

function fmtTarget(): string {
  if (url.startsWith('file:')) return `local SQLite (${url})`;
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

async function main() {
  console.log(`Target DB:    ${fmtTarget()}`);
  console.log(`Mode:         ${CONFIRMED ? '⚠️  LIVE — rows WILL be deleted' : 'dry run (pass --yes to actually delete)'}`);
  console.log('');

  console.log('Counting current rows…');
  const wipeCounts = await Promise.all(
    TABLES_TO_WIPE.map(async t => ({ name: t.name, count: await countRows(t) })),
  );
  const preserveCounts = await Promise.all(
    TABLES_TO_PRESERVE.map(async t => ({ name: t.name, count: await countRows(t) })),
  );

  const fmt = (count: number | null) =>
    count === null ? '   (missing)' : count.toLocaleString().padStart(8) + ' row(s)';

  console.log('');
  console.log('Will WIPE:');
  for (const r of wipeCounts) {
    console.log(`  - ${r.name.padEnd(14)}  ${fmt(r.count)}`);
  }
  console.log('');
  console.log('Will PRESERVE:');
  for (const r of preserveCounts) {
    console.log(`  - ${r.name.padEnd(14)}  ${fmt(r.count)}`);
  }
  console.log('');

  const missing = wipeCounts.filter(r => r.count === null).map(r => r.name);
  if (missing.length) {
    console.log(`(skipping missing tables: ${missing.join(', ')})`);
    console.log('');
  }

  if (!CONFIRMED) {
    console.log('Dry run complete. Re-run with `--yes` to actually delete.');
    await client.close();
    return;
  }

  console.log('Deleting…');
  for (const t of TABLES_TO_WIPE) {
    const before = wipeCounts.find(r => r.name === t.name)?.count;
    if (before === null) {
      console.log(`  – ${t.name.padEnd(14)} skipped (table does not exist)`);
      continue;
    }
    try {
      await db.delete(t.table);
      console.log(`  ✓ ${t.name.padEnd(14)} cleared (${(before ?? 0).toLocaleString()} row(s) removed)`);
    } catch (err) {
      if (isMissingTableError(err)) {
        console.log(`  – ${t.name.padEnd(14)} skipped (table does not exist)`);
      } else {
        throw err;
      }
    }
  }

  console.log('');
  console.log('Verifying…');
  const verify = await Promise.all(
    TABLES_TO_WIPE.map(async t => ({ name: t.name, count: await countRows(t) })),
  );
  const stragglers = verify.filter(r => r.count !== null && r.count > 0);
  if (stragglers.length) {
    console.warn('⚠️  Some tables still have rows after delete:');
    for (const r of stragglers) console.warn(`     - ${r.name}: ${r.count}`);
  } else {
    console.log('✅ All operational tables are empty (or absent).');
  }

  const finalPreserved = await Promise.all(
    TABLES_TO_PRESERVE.map(async t => ({ name: t.name, count: await countRows(t) })),
  );
  console.log('');
  console.log('Preserved tables (post-reset):');
  for (const r of finalPreserved) {
    console.log(`  - ${r.name.padEnd(14)} ${fmt(r.count)}`);
  }

  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
