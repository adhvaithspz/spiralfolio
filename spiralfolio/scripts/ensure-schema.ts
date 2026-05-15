/**
 * Idempotent column sync: adds any columns from lib/db/schema.ts that are
 * missing in the target DB (local file: or Turso). Safe to run on every deploy.
 *
 * Usage:
 *   npx tsx scripts/ensure-schema.ts
 *   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npx tsx scripts/ensure-schema.ts
 */
import { config } from 'dotenv';

config({ path: '.env.local' });

import { createClient } from '@libsql/client';

const rawUrl = process.env.TURSO_DATABASE_URL ?? 'file:./spiralfolio.db';
// Vercel builds must target Turso explicitly — a local file path would not migrate production.
if (process.env.VERCEL === '1' && !process.env.TURSO_DATABASE_URL) {
  console.error(
    '[ensure-schema] On Vercel, add TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN for cloud) to Build environment variables so the deploy migrations your Turso database.',
  );
  process.exit(1);
}
const url = rawUrl.startsWith('libsql://') ? rawUrl.replace('libsql://', 'https://') : rawUrl;
const authToken = process.env.TURSO_AUTH_TOKEN;

/** name → `ADD COLUMN name TYP ...` body (everything after column name). */
const TABLE_COLUMNS: Record<string, string[]> = {
  clients: [
    'engagement TEXT',
    'pm_name TEXT',
    'ad_name TEXT',
    "status TEXT DEFAULT 'on-track'",
    'success_metric TEXT',
    'drive_folder_url TEXT',
    'created_at INTEGER',
    'updated_at INTEGER',
  ],
  goals: ['position INTEGER DEFAULT 0', 'created_at INTEGER'],
  contacts: [
    'role TEXT',
    'is_approver INTEGER DEFAULT 0',
    'notes TEXT',
    "side TEXT NOT NULL DEFAULT 'client'",
    'created_at INTEGER',
  ],
  concerns: [
    'owner TEXT',
    'blocker_for TEXT',
    "status TEXT NOT NULL DEFAULT 'open'",
    'resolved_at INTEGER',
    'created_at INTEGER',
    'updated_at INTEGER',
    "history TEXT DEFAULT '[]'",
    'last_updated_call_id TEXT',
  ],
  deliverables: [
    'details TEXT',
    'owner TEXT',
    'due TEXT',
    "status TEXT NOT NULL DEFAULT 'pending'",
    "side TEXT NOT NULL DEFAULT 'us'",
    'created_at INTEGER',
    'updated_at INTEGER',
    'completed_at INTEGER',
    "history TEXT DEFAULT '[]'",
    'last_updated_call_id TEXT',
  ],
  decisions: [
    'decided_at INTEGER',
    'updated_at INTEGER',
    "history TEXT DEFAULT '[]'",
    'last_updated_call_id TEXT',
    'source_call_date TEXT',
    'source_call_id TEXT',
  ],
  wins: [
    'won_at INTEGER',
    'updated_at INTEGER',
    "history TEXT DEFAULT '[]'",
    'last_updated_call_id TEXT',
    'source_call_date TEXT',
    'source_call_id TEXT',
  ],
  documents: [
    'name TEXT',
    'drive_file_id TEXT',
    'doc_type TEXT',
    "key_facts TEXT DEFAULT '[]'",
    "flags TEXT DEFAULT '[]'",
    'ingested_at INTEGER',
  ],
  calls: [
    'call_type TEXT',
    'raw_transcript TEXT',
    'coaching_doc TEXT',
    'call_summary TEXT',
    "key_updates TEXT DEFAULT '[]'",
    "attendees_client TEXT DEFAULT '[]'",
    "attendees_internal TEXT DEFAULT '[]'",
    'brain_snapshot TEXT',
    'brain_changes TEXT',
    "status TEXT DEFAULT 'pending'",
    'created_at INTEGER',
  ],
  users: ['name TEXT', "role TEXT DEFAULT 'stakeholder'", 'created_at INTEGER'],
};

function colNameFromDef(def: string): string {
  const m = /^(\S+)/.exec(def.trim());
  return m ? m[1]! : def;
}

async function tableExists(client: ReturnType<typeof createClient>, table: string): Promise<boolean> {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    args: [table],
  });
  return (r.rows?.length ?? 0) > 0;
}

async function existingColumns(
  client: ReturnType<typeof createClient>,
  table: string,
): Promise<Set<string>> {
  const r = await client.execute({ sql: `PRAGMA table_info(${table})`, args: [] });
  const rows = r.rows as Array<{ name: string }>;
  return new Set(rows.map(row => row.name.toLowerCase()));
}

async function main() {
  console.log(`[ensure-schema] ${url.startsWith('file:') ? url : new URL(url).host}`);

  const client = createClient({ url, authToken });

  let added = 0;
  for (const [table, defs] of Object.entries(TABLE_COLUMNS)) {
    if (!(await tableExists(client, table))) {
      console.log(`[ensure-schema] skip (no table): ${table}`);
      continue;
    }

    const have = await existingColumns(client, table);
    for (const def of defs) {
      const colName = colNameFromDef(def);
      if (have.has(colName.toLowerCase())) continue;

      const sql = `ALTER TABLE ${table} ADD COLUMN ${def}`;
      try {
        await client.execute(sql);
        console.log(`[ensure-schema] + ${table}.${colName}`);
        added++;
        have.add(colName.toLowerCase());
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/duplicate column/i.test(msg)) continue;
        throw e;
      }
    }
  }

  console.log(`[ensure-schema] done (${added} column(s) added).`);
}

main().catch(err => {
  console.error('[ensure-schema] failed:', err);
  process.exit(1);
});
