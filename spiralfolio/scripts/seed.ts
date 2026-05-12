/**
 * Seed script — sourced entirely from appscript-library/ParticipantDetection.js
 * and appscript-library/Config.js. No mock data.
 *
 *   npm run db:seed
 *
 * Idempotent on client name. To reset:
 *   rm spiralfolio.db* && npx drizzle-kit push && npm run db:seed
 */
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { clients, users } from '../lib/db/schema';
import { nanoid } from '../lib/utils/nanoid';

const dbPath = process.env.DATABASE_URL ?? path.join(process.cwd(), 'spiralfolio.db');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite);

// ─── Team members ────────────────────────────────────────────────────────────
// Source: Config.js (emails) + ParticipantDetection.js (canonical names)

const LEADERSHIP = [
  { name: 'Gajan Retnasaba', email: 'gajan@spiralyze.com',  role: 'admin' as const },
  { name: 'Sahil Patel',     email: 'sahil@spiralyze.com',  role: 'admin' as const },
  { name: 'Farouk Elmoursi', email: 'farouk@spiralyze.com', role: 'ad'    as const },
];

const ADS = [
  { name: 'Daria Morozova', email: 'daria@spiralyze.com',        role: 'ad' as const },
  { name: 'Lazar Bojicic',  email: 'lazarb@spiralyze.com',       role: 'ad' as const },
  { name: 'Rashad',         email: 'abdelrahman@spiralyze.com',   role: 'ad' as const },
  { name: 'Thomas Boyle',   email: 'thomas@spiralyze.com',        role: 'ad' as const },
  { name: 'Harry Vermeulen',email: 'harry@spiralyze.com',         role: 'ad' as const },
];

const PMS = [
  { name: 'Ray',             email: 'ray@spiralyze.com',       role: 'pm' as const },
  { name: 'Arbab',           email: 'arbab@spiralyze.com',     role: 'pm' as const },
  { name: 'Furqaan',         email: 'furqaan@spiralyze.com',   role: 'pm' as const },
  { name: 'Nikita',          email: 'nikitad@spiralyze.com',   role: 'pm' as const },
  { name: 'Helen Regnier',   email: 'helenr@spiralyze.com',    role: 'pm' as const },
  { name: 'Sanan',           email: 'sanan@spiralyze.com',     role: 'pm' as const },
  { name: 'Jack',            email: 'jack@spiralyze.com',      role: 'pm' as const },
  { name: 'Eric',            email: 'eric@spiralyze.com',      role: 'pm' as const },
  { name: 'Josh',            email: 'josh@spiralyze.com',      role: 'pm' as const },
  { name: 'Jessica',         email: 'jessica@spiralyze.com',   role: 'pm' as const },
  { name: 'Joao',            email: 'joao@spiralyze.com',      role: 'pm' as const },
  { name: 'Rafay',           email: 'rafay@spiralyze.com',     role: 'pm' as const },
  { name: 'Bilal',           email: 'bilal@spiralyze.com',     role: 'pm' as const },
  { name: 'Tatiana',         email: 'tatiana@spiralyze.com',   role: 'pm' as const },
  { name: 'Beth Lund',       email: 'beth@spiralyze.com',      role: 'pm' as const },
  { name: 'Sebastian Maier', email: 'sebastian@spiralyze.com', role: 'pm' as const },
  { name: 'Rebekah Sproul',  email: 'rebekah@spiralyze.com',   role: 'pm' as const },
];

// ─── Full-name lookup by short name (as used in CLIENT_TEAM_MAP) ─────────────

const AD_NAME: Record<string, string> = {
  Daria:  'Daria Morozova',
  Lazar:  'Lazar Bojicic',
  Rashad: 'Rashad',
  Thomas: 'Thomas Boyle',
  Harry:  'Harry Vermeulen',
  Farouk: 'Farouk Elmoursi',
  Gajan:  'Gajan Retnasaba',
};

const PM_NAME: Record<string, string> = {
  Furqaan:   'Furqaan',
  Sanan:     'Sanan',
  Jack:      'Jack',
  Eric:      'Eric',
  Nikita:    'Nikita',
  Josh:      'Josh',
  Ray:       'Ray',
  Jessica:   'Jessica',
  Joao:      'Joao',
  Rafay:     'Rafay',
  Bilal:     'Bilal',
  Arbab:     'Arbab',
  Tatiana:   'Tatiana',
  Beth:      'Beth Lund',
  Sebastian: 'Sebastian Maier',
  Helen:     'Helen Regnier',
  Lazar:     'Lazar Bojicic', // PM for OneMain — also an AD
};

// ─── Clients ─────────────────────────────────────────────────────────────────
// Source: CLIENT_TEAM_MAP in ParticipantDetection.js
// Deduplicated — aliases (e.g. 'relay'/'relayfi', '32auctions'/'32 auctions')
// are collapsed to a single canonical display name.

type ClientSeed = { name: string; ad: string; pm: string };

const CLIENTS: ClientSeed[] = [
  // ── Daria / Sanan ──────────────────────────────────────────────────────────
  { name: 'Netwrix',           ad: 'Daria',   pm: 'Sanan'    },
  { name: 'Dialpad',           ad: 'Daria',   pm: 'Sanan'    },
  { name: 'Gainsight',         ad: 'Daria',   pm: 'Sanan'    },
  { name: 'Shippo',            ad: 'Daria',   pm: 'Sanan'    },
  // ── Daria / Jack ───────────────────────────────────────────────────────────
  { name: 'Paycor',            ad: 'Daria',   pm: 'Jack'     },
  { name: 'SailPoint',         ad: 'Daria',   pm: 'Jack'     },
  { name: '2U',                ad: 'Daria',   pm: 'Jack'     },
  { name: 'AirSculpt',         ad: 'Daria',   pm: 'Jack'     },
  // ── Daria / Eric ───────────────────────────────────────────────────────────
  { name: 'American Family Care', ad: 'Daria', pm: 'Eric'   },
  { name: 'Upwork',            ad: 'Daria',   pm: 'Eric'     },
  { name: 'ActivTrak',         ad: 'Daria',   pm: 'Eric'     },
  { name: 'AAA',               ad: 'Daria',   pm: 'Eric'     },
  // ── Lazar / Nikita ─────────────────────────────────────────────────────────
  { name: 'Whatfix',           ad: 'Lazar',   pm: 'Nikita'   },
  { name: 'Fishbowl',          ad: 'Lazar',   pm: 'Nikita'   },
  // ── Lazar / Lazar (PM = AD) ────────────────────────────────────────────────
  { name: 'OneMain',           ad: 'Lazar',   pm: 'Lazar'    },
  // ── Lazar / Josh ───────────────────────────────────────────────────────────
  { name: 'BambooHR',          ad: 'Lazar',   pm: 'Josh'     },
  { name: 'Zeffy',             ad: 'Lazar',   pm: 'Josh'     },
  { name: 'Cleerly',           ad: 'Lazar',   pm: 'Josh'     },
  { name: 'Fieldguide',        ad: 'Lazar',   pm: 'Josh'     },
  // ── Lazar / Ray ────────────────────────────────────────────────────────────
  { name: 'AffiniPay',         ad: 'Lazar',   pm: 'Ray'      },
  { name: 'Service Fusion',    ad: 'Lazar',   pm: 'Ray'      },
  { name: 'Joist',             ad: 'Lazar',   pm: 'Ray'      },
  { name: 'Invoice Simple',    ad: 'Lazar',   pm: 'Ray'      },
  // ── Rashad / Jessica ───────────────────────────────────────────────────────
  { name: 'Bill',              ad: 'Rashad',  pm: 'Jessica'  },
  { name: 'Relay Financial',   ad: 'Rashad',  pm: 'Jessica'  },
  { name: 'Mixpanel',          ad: 'Rashad',  pm: 'Jessica'  },
  // ── Rashad / Joao ──────────────────────────────────────────────────────────
  { name: 'Absorb LMS',        ad: 'Rashad',  pm: 'Joao'     },
  { name: 'Candela',           ad: 'Rashad',  pm: 'Joao'     },
  { name: 'Domo',              ad: 'Rashad',  pm: 'Joao'     },
  // ── Rashad / Rafay ─────────────────────────────────────────────────────────
  { name: 'ShareGate',         ad: 'Rashad',  pm: 'Rafay'    },
  { name: 'Rapid7',            ad: 'Rashad',  pm: 'Rafay'    },
  { name: 'RocketReach',       ad: 'Rashad',  pm: 'Rafay'    },
  // ── Thomas / Bilal ─────────────────────────────────────────────────────────
  { name: 'InsightSoftware',   ad: 'Thomas',  pm: 'Bilal'    },
  { name: 'ConnectWise',       ad: 'Thomas',  pm: 'Bilal'    },
  { name: 'Semgrep',           ad: 'Thomas',  pm: 'Bilal'    },
  // ── Thomas / Arbab ─────────────────────────────────────────────────────────
  { name: 'Geotab',            ad: 'Thomas',  pm: 'Arbab'    },
  { name: 'Maxio',             ad: 'Thomas',  pm: 'Arbab'    },
  { name: 'Tempo',             ad: 'Thomas',  pm: 'Arbab'    },
  { name: '32Auctions',        ad: 'Thomas',  pm: 'Arbab'    },
  // ── Thomas / Tatiana ───────────────────────────────────────────────────────
  { name: 'Lendio',            ad: 'Thomas',  pm: 'Tatiana'  },
  { name: 'Stoneside',         ad: 'Thomas',  pm: 'Tatiana'  },
  { name: 'Highspot',          ad: 'Thomas',  pm: 'Tatiana'  },
  { name: 'Greenlight Guru',   ad: 'Thomas',  pm: 'Tatiana'  },
  // ── Harry / Beth ───────────────────────────────────────────────────────────
  { name: 'Moorepay',          ad: 'Harry',   pm: 'Beth'     },
  { name: 'Canoe Intelligence', ad: 'Harry',  pm: 'Beth'     },
  { name: 'Teleport',          ad: 'Harry',   pm: 'Beth'     },
  { name: 'Fleetio',           ad: 'Harry',   pm: 'Beth'     },
  // ── Harry / Sebastian ──────────────────────────────────────────────────────
  { name: 'Flashpoint',        ad: 'Harry',   pm: 'Sebastian'},
  { name: 'Honeycomb',         ad: 'Harry',   pm: 'Sebastian'},
  { name: 'Agiloft',           ad: 'Harry',   pm: 'Sebastian'},
  { name: 'Beck Technology',   ad: 'Harry',   pm: 'Sebastian'},
  // ── Farouk / Furqaan ───────────────────────────────────────────────────────
  { name: 'TechSmith',         ad: 'Farouk',  pm: 'Furqaan'  },
  { name: 'Tenable',           ad: 'Farouk',  pm: 'Furqaan'  },
  { name: 'PEBL',              ad: 'Farouk',  pm: 'Furqaan'  },
  { name: 'Rasa',              ad: 'Farouk',  pm: 'Furqaan'  },
  { name: 'Matik',             ad: 'Farouk',  pm: 'Furqaan'  },
  // ── Gajan / Helen ──────────────────────────────────────────────────────────
  { name: 'Ramp',              ad: 'Gajan',   pm: 'Helen'    },
];

function main() {
  const now = new Date();

  // ── Users ──────────────────────────────────────────────────────────────────
  const allTeam = [...LEADERSHIP, ...ADS, ...PMS];
  let usersAdded = 0;
  for (const member of allTeam) {
    const existing = db.select().from(users).where(eq(users.email, member.email)).get();
    if (existing) continue;
    db.insert(users)
      .values({ id: nanoid(), email: member.email, name: member.name, role: member.role, createdAt: now })
      .run();
    usersAdded++;
  }
  console.log(`Users: ${usersAdded} added (${allTeam.length - usersAdded} already existed)`);

  // ── Clients ─────────────────────────────────────────────────────────────────
  let clientsAdded = 0;
  for (const c of CLIENTS) {
    const existing = db.select().from(clients).where(eq(clients.name, c.name)).get();
    if (existing) continue;
    db.insert(clients)
      .values({
        id: nanoid(),
        name: c.name,
        engagement: null,
        pmName: PM_NAME[c.pm] ?? c.pm,
        adName: AD_NAME[c.ad] ?? c.ad,
        status: 'on-track',
        successMetric: null,
        slackChannelId: null,
        asanaProjectId: null,
        driveFolderUrl: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    clientsAdded++;
  }
  console.log(`Clients: ${clientsAdded} added (${CLIENTS.length - clientsAdded} already existed)`);
}

main();
