// ═══════════════════════════════════════════════════════════════
//  ParticipantDetection.gs
//  Built from MASTER___Spiralyze_Clients___Teams.xlsx
//  Last updated: Apr 2026
//
//  ROLE HIERARCHY (used for coaching prompt labeling):
//    FOUNDER       — Gajan Retnasaba
//    CEO           — Sahil Patel
//    CTO           — Yaseen
//    VP            — Farouk Elmoursi (VP Operations)
//    AD            — Account Directors
//    PM            — Project Managers
//    STRATEGIST    — Conversion Strategists / Researchers
//    ANALYTICS     — Analytics team
//    DEV           — Dev managers, leads, engineers
//    QA            — QA leads, QA owners
//    DESIGN        — Design leads
//    SALES         — Sales & Growth team
//    OPS           — Ops / internal roles
//    OTHER         — VA, assistants, HR, other staff
// ═══════════════════════════════════════════════════════════════


// ───────────────────────────────────────────────────────────────
//  LEADERSHIP
// ───────────────────────────────────────────────────────────────
const SPIRALYZE_LEADERSHIP = [
  { canonicalName: 'Gajan Retnasaba',  role: 'FOUNDER',  patterns: ['gajan retnasaba', 'gajan'] },
  { canonicalName: 'Sahil Patel',      role: 'CEO',       patterns: ['sahil patel', 'sahil'] },
  { canonicalName: 'Yaseen',           role: 'CTO',       patterns: ['yaseen'] },
  { canonicalName: 'Farouk Elmoursi',  role: 'VP',        patterns: ['farouk elmoursi', 'farouk'] },
];

// ───────────────────────────────────────────────────────────────
//  ACCOUNT DIRECTORS
//  Source: Client List sheet (AD column) + Ops sheet
// ───────────────────────────────────────────────────────────────
const SPIRALYZE_AD_MATCHERS = [
  { canonicalName: 'Daria Morozova',      role: 'AD', patterns: ['daria morozova', 'daria'] },
  { canonicalName: 'Lazar Bojicic',       role: 'AD', patterns: ['lazar bojicic', 'lazar'] },
  { canonicalName: 'Rashad',              role: 'AD', patterns: ['abdelrahman rashad', 'rashad'] },
  { canonicalName: 'Thomas Boyle',        role: 'AD', patterns: ['thomas boyle', 'thomas'] },
  { canonicalName: 'Harry Vermeulen',     role: 'AD', patterns: ['harry vermeulen', 'harry'] },
  // Ops sheet ADs
  { canonicalName: 'Dheeraj',            role: 'AD', patterns: ['dheeraj'] },
  { canonicalName: 'Jamie',              role: 'AD', patterns: ['jamie'] },
  { canonicalName: 'Ahmed',              role: 'AD', patterns: ['ahmed'] },
  // Internal project ADs
  { canonicalName: 'Mitko',             role: 'AD', patterns: ['mitko'] },
  { canonicalName: 'Angelica',          role: 'AD', patterns: ['angelica'] },
  { canonicalName: 'Mohamed',           role: 'AD', patterns: ['mohamed'] },
  { canonicalName: 'Hassan',            role: 'AD', patterns: ['hassan'] },
];

// ───────────────────────────────────────────────────────────────
//  PROJECT MANAGERS
//  Source: Client List sheet (PM column) + Account Directors & PMs sheet
// ───────────────────────────────────────────────────────────────
const SPIRALYZE_PM_MATCHERS = [
  // Active client PMs
  { canonicalName: 'Furqaan',           role: 'PM', patterns: ['furqaan'] },
  { canonicalName: 'Sanan',             role: 'PM', patterns: ['sanan'] },
  { canonicalName: 'Jack',              role: 'PM', patterns: ['jack'] },
  { canonicalName: 'Eric',              role: 'PM', patterns: ['eric'] },
  { canonicalName: 'Nikita',            role: 'PM', patterns: ['nikita'] },
  { canonicalName: 'Josh',              role: 'PM', patterns: ['josh'] },
  { canonicalName: 'Ray',               role: 'PM', patterns: ['ray'] },
  { canonicalName: 'Jessica',           role: 'PM', patterns: ['jessica'] },
  { canonicalName: 'Joao',              role: 'PM', patterns: ['joao'] },
  { canonicalName: 'Rafay',             role: 'PM', patterns: ['rafay'] },
  { canonicalName: 'Bilal',             role: 'PM', patterns: ['bilal'] },
  { canonicalName: 'Arbab',             role: 'PM', patterns: ['arbab'] },
  { canonicalName: 'Tatiana',           role: 'PM', patterns: ['tatiana'] },
  { canonicalName: 'Beth Lund',         role: 'PM', patterns: ['beth lund', 'beth'] },
  { canonicalName: 'Sebastian Maier',   role: 'PM', patterns: ['sebastian maier', 'sebastian'] },
  { canonicalName: 'Helen Regnier',     role: 'PM', patterns: ['helen regnier', 'helen'] },
  // Ops sheet PMs
  { canonicalName: 'Abou',              role: 'PM', patterns: ['abou', 'aboubaker'] },
  { canonicalName: 'Shabbir',           role: 'PM', patterns: ['shabbir'] },
  { canonicalName: 'Warren',            role: 'PM', patterns: ['warren'] },
  { canonicalName: 'Rahat',             role: 'PM', patterns: ['rahat'] },
  { canonicalName: 'Lazar',             role: 'PM', patterns: ['lazar'] }, // also AD — AD takes precedence via lookup order
  { canonicalName: 'Ivana',             role: 'PM', patterns: ['ivana', 'ivanaz'] },
  { canonicalName: 'Aziz',              role: 'PM', patterns: ['aziz', 'miraziz'] },
];

// ───────────────────────────────────────────────────────────────
//  CONVERSION STRATEGISTS & RESEARCHERS
//  Source: Ops sheet (Conversion Strategist + Research columns)
// ───────────────────────────────────────────────────────────────
const SPIRALYZE_STRATEGIST_MATCHERS = [
  { canonicalName: 'Traci',             role: 'STRATEGIST', patterns: ['traci'] },
  { canonicalName: 'Benjamin',          role: 'STRATEGIST', patterns: ['benjamin'] },
  { canonicalName: 'MacKenzie',         role: 'STRATEGIST', patterns: ['mackenzie'] },
  { canonicalName: 'Allie',             role: 'STRATEGIST', patterns: ['allie'] },
  { canonicalName: 'Erica',             role: 'STRATEGIST', patterns: ['erica'] },
  // Research
  { canonicalName: 'Hannah',            role: 'RESEARCH',   patterns: ['hannah'] },
  { canonicalName: 'Judith',            role: 'RESEARCH',   patterns: ['judith'] },
  { canonicalName: 'Ron',               role: 'RESEARCH',   patterns: ['ron'] },
  { canonicalName: 'Nigel',             role: 'RESEARCH',   patterns: ['nigel'] },
];

// ───────────────────────────────────────────────────────────────
//  ANALYTICS TEAM
//  Source: Analytics sheet
// ───────────────────────────────────────────────────────────────
const SPIRALYZE_ANALYTICS_MATCHERS = [
  { canonicalName: 'Martin',            role: 'ANALYTICS', patterns: ['martin'] },
  { canonicalName: 'Ivana',             role: 'ANALYTICS', patterns: ['ivana'] },
  { canonicalName: 'Jhun',              role: 'ANALYTICS', patterns: ['jhun'] },
  { canonicalName: 'Yasir',             role: 'ANALYTICS', patterns: ['yasir'] },
  { canonicalName: 'Moustafa',          role: 'ANALYTICS', patterns: ['moustafa'] },
  { canonicalName: 'Esteann',           role: 'ANALYTICS', patterns: ['esteann'] },
  { canonicalName: 'Matias',            role: 'ANALYTICS', patterns: ['matias'] },
  { canonicalName: 'Jefferson',         role: 'ANALYTICS', patterns: ['jefferson'] },
];

// ───────────────────────────────────────────────────────────────
//  DESIGN LEADS
//  Source: Client List sheet (Design Lead column)
// ───────────────────────────────────────────────────────────────
const SPIRALYZE_DESIGN_MATCHERS = [
  { canonicalName: 'Rebekah Sproul',    role: 'DESIGN', patterns: ['rebekah sproul', 'rebekah', 'rebecca sproul', 'rebecca'] },
  { canonicalName: 'Maja',              role: 'DESIGN', patterns: ['maja'] },
  { canonicalName: 'Andrew',            role: 'DESIGN', patterns: ['andrew'] },
  { canonicalName: 'Sergy',             role: 'DESIGN', patterns: ['sergy'] },
  { canonicalName: 'Don',               role: 'DESIGN', patterns: ['don', 'donatas'] },
  { canonicalName: 'Taras',             role: 'DESIGN', patterns: ['taras'] },
  { canonicalName: 'Mark',              role: 'DESIGN', patterns: ['mark'] },
  { canonicalName: 'Alina',             role: 'DESIGN', patterns: ['alina'] },
  { canonicalName: 'Nikita',            role: 'DESIGN', patterns: ['nikita'] }, // also PM
];

// ───────────────────────────────────────────────────────────────
//  DEV TEAM
//  Source: Dev Teams sheet (managers + leads)
// ───────────────────────────────────────────────────────────────
const SPIRALYZE_DEV_MATCHERS = [
  // Dev Managers
  { canonicalName: 'Mamoon',            role: 'DEV_MANAGER', patterns: ['mamoon'] },
  { canonicalName: 'Bhavesh',           role: 'DEV_MANAGER', patterns: ['bhavesh'] },
  { canonicalName: 'Yuriy',             role: 'DEV_MANAGER', patterns: ['yuriy', 'yurii'] },
  { canonicalName: 'Kartik',            role: 'DEV_MANAGER', patterns: ['kartik'] },
  { canonicalName: 'Vaibhav',           role: 'DEV_MANAGER', patterns: ['vaibhav'] },
  // Dev Leads
  { canonicalName: 'Prakash',           role: 'DEV_LEAD', patterns: ['prakash'] },
  { canonicalName: 'Riyaz',             role: 'DEV_LEAD', patterns: ['riyaz'] },
  { canonicalName: 'Dhaval',            role: 'DEV_LEAD', patterns: ['dhaval'] },
  { canonicalName: 'Rajesh',            role: 'DEV_LEAD', patterns: ['rajesh'] },
  { canonicalName: 'Mirza',             role: 'DEV_LEAD', patterns: ['mirza'] },
  { canonicalName: 'Sadik',             role: 'DEV_LEAD', patterns: ['sadik'] },
  { canonicalName: 'Umair',             role: 'DEV_LEAD', patterns: ['umair'] },
];

// ───────────────────────────────────────────────────────────────
//  QA TEAM
//  Source: QA Teams sheet
// ───────────────────────────────────────────────────────────────
const SPIRALYZE_QA_MATCHERS = [
  { canonicalName: 'Najma',             role: 'QA_MANAGER', patterns: ['najma'] },
  { canonicalName: 'Rachelle',          role: 'QA',         patterns: ['rachelle'] },
  { canonicalName: 'Srikanth SY',       role: 'QA_LEAD',    patterns: ['srikanth sy', 'srikanth'] },
  { canonicalName: 'Elah',              role: 'QA_LEAD',    patterns: ['elah'] },
  { canonicalName: 'Azhar',             role: 'QA_LEAD',    patterns: ['azhar'] },
  { canonicalName: 'Eugene',            role: 'QA_LEAD',    patterns: ['eugene'] },
  { canonicalName: 'Akhila',            role: 'QA_OWNER',   patterns: ['akhila'] },
  { canonicalName: 'Laya',              role: 'QA_OWNER',   patterns: ['laya'] },
  { canonicalName: 'Gaurav',            role: 'QA_OWNER',   patterns: ['gaurav'] },
  { canonicalName: 'Ryan',              role: 'QA_OWNER',   patterns: ['ryan'] },
  { canonicalName: 'Rolito',            role: 'QA_OWNER',   patterns: ['rolito'] },
  { canonicalName: 'Sonali',            role: 'QA_OWNER',   patterns: ['sonali'] },
  { canonicalName: 'Marian',            role: 'QA_OWNER',   patterns: ['marian'] },
  { canonicalName: 'Waleed',            role: 'QA_OWNER',   patterns: ['waleed'] },
  { canonicalName: 'Fahad',             role: 'QA_OWNER',   patterns: ['fahad'] },
  { canonicalName: 'Selvamani',         role: 'QA',         patterns: ['selvamani'] },
];

// ───────────────────────────────────────────────────────────────
//  SALES & GROWTH TEAM
//  Source: SalesGrowth sheet
// ───────────────────────────────────────────────────────────────
const SPIRALYZE_SALES_MATCHERS = [
  { canonicalName: 'Roland',            role: 'SALES', patterns: ['roland'] },
  { canonicalName: 'Ranjith',           role: 'SALES', patterns: ['ranjith'] },
  { canonicalName: 'Sydney',            role: 'SALES', patterns: ['sydney'] },
  { canonicalName: 'JM',                role: 'SALES', patterns: ['jm'] },
  { canonicalName: 'Kurt',              role: 'SALES', patterns: ['kurt'] },
  { canonicalName: 'Ben',               role: 'SALES', patterns: ['ben'] },
  { canonicalName: 'Jose',              role: 'SALES', patterns: ['jose'] },
];

// ───────────────────────────────────────────────────────────────
//  OTHER / SUPPORT STAFF
//  Source: Other sheet, HR sheet, Figma Editors
// ───────────────────────────────────────────────────────────────
const SPIRALYZE_OTHER_MATCHERS = [
  { canonicalName: 'Sophie T.',         role: 'OTHER', patterns: ['sophie t', 'sophie'] },
  { canonicalName: 'Lynn',              role: 'OTHER', patterns: ['lynn'] },
  { canonicalName: 'Elton',             role: 'OTHER', patterns: ['elton'] },
  { canonicalName: 'Quirino',           role: 'OTHER', patterns: ['quirino'] },
  { canonicalName: 'Aleksandra',        role: 'HR',    patterns: ['aleksandra'] },
  { canonicalName: 'Chelsey',           role: 'HR',    patterns: ['chelsey'] },
  { canonicalName: 'Gia',               role: 'HR',    patterns: ['gia'] },
  { canonicalName: 'Beatriz',           role: 'HR',    patterns: ['beatriz'] },
];

// ───────────────────────────────────────────────────────────────
//  ALL MATCHER ARRAYS IN PRIORITY ORDER
//  Leadership checked first so Farouk is never classified as AD
// ───────────────────────────────────────────────────────────────
const ALL_SPIRALYZE_MATCHERS = [
  SPIRALYZE_LEADERSHIP,
  SPIRALYZE_AD_MATCHERS,
  SPIRALYZE_PM_MATCHERS,
  SPIRALYZE_STRATEGIST_MATCHERS,
  SPIRALYZE_ANALYTICS_MATCHERS,
  SPIRALYZE_DESIGN_MATCHERS,
  SPIRALYZE_DEV_MATCHERS,
  SPIRALYZE_QA_MATCHERS,
  SPIRALYZE_SALES_MATCHERS,
  SPIRALYZE_OTHER_MATCHERS,
];

// ───────────────────────────────────────────────────────────────
//  CLIENT NAME LOOKUP
//  Maps client names → their AD and PM first names
//  Source: Client List sheet
//  Used by: buildCoachingPrompt to auto-fill pmLabel / adLabel
//           when they can't be resolved from Zoom participants
// ───────────────────────────────────────────────────────────────
const CLIENT_TEAM_MAP = {
  'netwrix':           { ad: 'Daria',   pm: 'Sanan'    },
  'dialpad':           { ad: 'Daria',   pm: 'Sanan'    },
  'gainsight':         { ad: 'Daria',   pm: 'Sanan'    },
  'shippo':            { ad: 'Daria',   pm: 'Sanan'    },
  'paycor':            { ad: 'Daria',   pm: 'Jack'     },
  'sailpoint':         { ad: 'Daria',   pm: 'Jack'     },
  '2u':                { ad: 'Daria',   pm: 'Jack'     },
  'airsculpt':         { ad: 'Daria',   pm: 'Jack'     },
  'american family care': { ad: 'Daria', pm: 'Eric'   },
  'afc':                  { ad: 'Daria', pm: 'Eric' },
  'upwork':            { ad: 'Daria',   pm: 'Eric'     },
  'activtrak':         { ad: 'Daria',   pm: 'Eric'     },
  'whatfix':           { ad: 'Lazar',   pm: 'Nikita'   },
  'fishbowl':          { ad: 'Lazar',   pm: 'Nikita'   },
  'onemain':           { ad: 'Lazar',   pm: 'Lazar'    },
  'bamboohr':          { ad: 'Lazar',   pm: 'Josh'     },
  'zeffy':             { ad: 'Lazar',   pm: 'Josh'     },
  'cleerly':           { ad: 'Lazar',   pm: 'Josh'     },
  'affinipay':         { ad: 'Lazar',   pm: 'Ray'      },
  'service fusion':    { ad: 'Lazar',   pm: 'Ray'      },
  'servicefusion':     { ad: 'Lazar', pm: 'Ray' },
  'joist':             { ad: 'Lazar',   pm: 'Ray'      },
  'invoice simple':    { ad: 'Lazar',   pm: 'Ray'      },
  'bill':              { ad: 'Rashad',  pm: 'Jessica'  },
  'relayfi':           { ad: 'Rashad',  pm: 'Jessica'  },
  'relay':             { ad: 'Rashad',  pm: 'Jessica'  },
  'mixpanel':          { ad: 'Rashad',  pm: 'Jessica'  },
  'absorb':            { ad: 'Rashad',  pm: 'Joao'     },
  'candela':           { ad: 'Rashad',  pm: 'Joao'     },
  'domo':              { ad: 'Rashad',  pm: 'Joao'     },
  'sharegate':         { ad: 'Rashad',  pm: 'Rafay'    },
  'rapid7':            { ad: 'Rashad',  pm: 'Rafay'    },
  'rocket reach':      { ad: 'Rashad',  pm: 'Rafay'    },
  'rocketreach':       { ad: 'Rashad',  pm: 'Rafay'    },
  'insightsoftware':   { ad: 'Thomas',  pm: 'Bilal'    },
  'insight software':  { ad: 'Thomas',  pm: 'Bilal'    },
  'connectwise':       { ad: 'Thomas',  pm: 'Bilal'    },
  'semgrep':           { ad: 'Thomas',  pm: 'Bilal'    },
  'geotab':            { ad: 'Thomas',  pm: 'Arbab'    },
  'maxio':             { ad: 'Thomas',  pm: 'Arbab'    },
  'tempo':             { ad: 'Thomas',  pm: 'Arbab'    },
  '32auctions':        { ad: 'Thomas',  pm: 'Arbab'    },
  '32 auctions':       { ad: 'Thomas',  pm: 'Arbab'    },
  'lendio':            { ad: 'Thomas',  pm: 'Tatiana'  },
  'stoneside':         { ad: 'Thomas',  pm: 'Tatiana'  },
  'highspot':          { ad: 'Thomas',  pm: 'Tatiana'  },
  'greenlight guru':   { ad: 'Thomas',  pm: 'Tatiana'  },
  'moorepay':          { ad: 'Harry',   pm: 'Beth'     },
  'canoe intelligence':{ ad: 'Harry',   pm: 'Beth'     },
  'teleport':          { ad: 'Harry',   pm: 'Beth'     },
  'fleetio':           { ad: 'Harry',   pm: 'Beth'     },
  'flashpoint':        { ad: 'Harry',   pm: 'Sebastian'},
  'honeycomb':         { ad: 'Harry',   pm: 'Sebastian'},
  'agiloft':           { ad: 'Harry',   pm: 'Sebastian'},
  'beck technology':   { ad: 'Harry',   pm: 'Sebastian'},
  'techsmith':         { ad: 'Farouk',  pm: 'Furqaan'  },
  'tenable':           { ad: 'Farouk',  pm: 'Furqaan'  },
  'pebl':              { ad: 'Farouk',  pm: 'Furqaan'  },
  'rasa':              { ad: 'Farouk',  pm: 'Furqaan'  },
  'matik':             { ad: 'Farouk',  pm: 'Furqaan'  },
  'ramp':              { ad: 'Gajan',   pm: 'Helen'    },
  'fieldguide':        { ad: 'Lazar',   pm: 'Josh'    },
  'aaa':               { ad: 'Daria',   pm: 'Eric'    },
};

/**
 * Look up AD and PM names for a given client name.
 * Returns { ad, pm } or null if not found.
 * Used as a fallback when Zoom participant resolution fails.
 */
function lookupClientTeam(clientName) {
  if (!clientName) return null;
  const key = clientName.toLowerCase().trim();
  return CLIENT_TEAM_MAP[key] || null;
}


// ═══════════════════════════════════════════════════════════════
//  CORE DETECTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Normalize a display name for fuzzy matching.
 * Strips brackets, parentheses, "zoom meeting" suffix, punctuation.
 */
function normalizeParticipantName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/'s zoom meeting/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find a match in a single matcher array by participant name.
 */
function findNameMatcher(participantName, matchers) {
  const normalized = normalizeParticipantName(participantName);
  if (!normalized) return null;

  for (let i = 0; i < matchers.length; i++) {
    const matcher = matchers[i];
    for (let j = 0; j < matcher.patterns.length; j++) {
      const pattern = matcher.patterns[j];
      if (
        normalized === pattern ||
        normalized.startsWith(pattern + ' ') ||
        normalized.indexOf(' ' + pattern + ' ') !== -1 ||
        normalized.endsWith(' ' + pattern)
      ) {
        return matcher;
      }
    }
  }
  return null;
}

/**
 * Returns the Spiralyze match object for a participant name,
 * or null if not recognized as a Spiralyze team member.
 * Checks arrays in priority order: Leadership → AD → PM → … → Other
 */
function getSpiralyzeParticipantMatch(participantName) {
  for (let a = 0; a < ALL_SPIRALYZE_MATCHERS.length; a++) {
    const match = findNameMatcher(participantName, ALL_SPIRALYZE_MATCHERS[a]);
    if (match) return match; // match object includes { canonicalName, role, patterns }
  }
  return null;
}

/**
 * Returns true if a participant name belongs to the Spiralyze team.
 */
function isSpiralyzeTeamMember(participantName) {
  return !!getSpiralyzeParticipantMatch(participantName);
}

/**
 * Get list of internal (Spiralyze) participants from a participants array.
 * Each returned object: { name, canonicalName, role, email, user_id }
 */
function getInternalParticipants(participants) {
  if (!participants) return [];

  const seen = {};

  return participants
    .map(p => {
      const match = getSpiralyzeParticipantMatch(p.name);
      if (!match) return null;
      return {
        name:          p.name || match.canonicalName,
        canonicalName: match.canonicalName,
        role:          match.role,
        email:         p.email || null,
        user_id:       p.user_id || null,
      };
    })
    .filter(Boolean)
    .filter(p => {
      // Keep only the first occurrence of each canonical name
      if (seen[p.canonicalName]) return false;
      seen[p.canonicalName] = true;
      return true;
    });
}

/**
 * Get list of external (non-Spiralyze) participants.
 */
function getExternalParticipants(participants) {
  if (!participants) return [];
  return participants.filter(p => !getSpiralyzeParticipantMatch(p.name));
}

/**
 * Extract PM name from internal participants list.
 * Falls back to topic-based extraction, then CLIENT_TEAM_MAP.
 */
function extractPMNameFromParticipants(internalParticipants, meetingTopic) {

  // CLIENT_TEAM_MAP is the source of truth — always check it first
  const clientName = extractClientName(meetingTopic);
  const teamInfo   = lookupClientTeam(clientName);

  if (teamInfo && teamInfo.pm) {
    // Verify this PM is actually present in the participant list
    // If yes, use the map. If not present at all, still use the map
    // (they may have joined under a different name spelling).
    Logger.log(`CLIENT_TEAM_MAP resolved PM for "${clientName}": ${teamInfo.pm}`);
    return teamInfo.pm;
  }

  // Fallback: find PM role in detected internal participants
  if (internalParticipants && internalParticipants.length > 0) {
    const pm = internalParticipants.find(p => p.role === 'PM');
    if (pm) return pm.canonicalName || pm.name || 'Unknown PM';
  }

  return extractPMName([], meetingTopic);
}

/**
 * Extract AD name from internal participants list.
 * Falls back to topic-based extraction, then CLIENT_TEAM_MAP.
 */
function extractADNameFromParticipants(internalParticipants, meetingTopic) {

  // CLIENT_TEAM_MAP is the source of truth — always check it first
  const clientName = extractClientName(meetingTopic);
  const teamInfo   = lookupClientTeam(clientName);

  if (teamInfo && teamInfo.ad) {
    Logger.log(`CLIENT_TEAM_MAP resolved AD for "${clientName}": ${teamInfo.ad}`);
    return teamInfo.ad;
  }

  // Fallback: find AD role in detected internal participants
  if (internalParticipants && internalParticipants.length > 0) {
    const ad = internalParticipants.find(p => p.role === 'AD');
    if (ad) return ad.canonicalName || ad.name || 'Unknown AD';
  }

  return extractADName([], meetingTopic);
}

/**
 * Determine if a meeting should be treated as an external client call.
 * Rules:
 *   1. Title must contain '<>' (client <> Spiralyze format) OR
 *      at least one non-Spiralyze participant is present.
 *   2. If both sides of a '<>' title are recognized Spiralyze names → internal.
 *   3. bypassExternalCheck (from callType) overrides everything.
 */
function shouldTreatAsExternalClientCall(participants, meetingTopic) {
  const t = (meetingTopic || '').toLowerCase().trim();

  // ── Explicit internal patterns — skip immediately ──────────────────────
  // These titles contain only Spiralyze staff names or generic internal labels
  const INTERNAL_TITLE_PATTERNS = [
    /pm training/,
    /daily check.?in/,
    /weekly check.?in/,           // generic — no client name before it
    /team sync/,
    /standup/,
    /level up/,
    /wireframing/,
    /zoom meeting/,               // Zoom's default title — no client info
    /google calendar meeting/,
    /all hands/,
    /retro/,
    /planning/
  ];

  // Generic titles with no client name on the left side of <> or |
  if (INTERNAL_TITLE_PATTERNS.some(p => p.test(t))) {
    // Allow if a known client name appears before the pattern
    // e.g. "Teleport <> SPZ | CRO Weekly Check-in" — has client name
    const knownClients = Object.keys(CLIENT_TEAM_MAP); // from ParticipantDetection.gs
    const hasClientPrefix = knownClients.some(function(client) {
  const normalizedClient = client.toLowerCase().replace(/[\s\-_&.]+/g, '');
  const normalizedTopic  = t.replace(/[\s\-_&.]+/g, '');
  return normalizedTopic.startsWith(normalizedClient) ||
         normalizedTopic.includes(normalizedClient);
});
    if (!hasClientPrefix) {
      Logger.log('Internal title detected — skipping: ' + meetingTopic);
      return false;
    }
  }

  // ── <> format: check both sides ───────────────────────────────────────
  if (t.includes('<>')) {
    const sides = getMeetingTitleSides(meetingTopic);
    if (sides) {
      const leftMatch  = getSpiralyzeParticipantMatch(sides.left);
      const rightMatch = getSpiralyzeParticipantMatch(sides.right);
      // If BOTH sides resolve to Spiralyze people → internal
      if (leftMatch && rightMatch) {
        Logger.log('Both sides are internal — skipping: ' + meetingTopic);
        return false;
      }
      // If either side has no Spiralyze match → client is present → external
      if (!leftMatch || !rightMatch) return true;
    }
    return true;
  }

  // ── No <> — check participant list for any non-Spiralyze person ────────
  if (participants && participants.length > 0) {
    return participants.some(p => !getSpiralyzeParticipantMatch(p.name));
  }

  return false;
}

/**
 * Parse "Left <> Right | Subtitle" into { left, right }
 */
function getMeetingTitleSides(meetingTopic) {
  if (!meetingTopic || meetingTopic.indexOf('<>') === -1) return null;
  const mainPart = meetingTopic.split('|')[0].trim();
  const pieces   = mainPart.split('<>');
  if (pieces.length < 2) return null;
  return {
    left:  pieces[0].trim(),
    right: pieces[1].trim(),
  };
}

/**
 * Legacy helper — kept for backward compatibility.
 */
function isExternalMeeting(participants, meetingTopic) {
  return shouldTreatAsExternalClientCall(participants, meetingTopic);
}

/**
 * Get participant details for a meeting from Zoom API.
 */
function getParticipantDetails(meetingId, meetingUuid, token) {
  const url = `https://api.zoom.us/v2/past_meetings/${encodeURIComponent(meetingUuid)}/participants?page_size=300`;
  const options = {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result   = JSON.parse(response.getContentText());
    return result.participants || [];
  } catch (error) {
    Logger.log('Error fetching participant details: ' + error);
    return [];
  }
}

/**
 * Build participant context string for the coaching prompt.
 */
function buildParticipantContext(participants, isExternal, externalParticipants) {
  let context = `Meeting type: ${isExternal ? 'External (client call)' : 'Internal'}\n\n`;

  if (isExternal && externalParticipants && externalParticipants.length > 0) {
    context += '**External Participants (Client Side):**\n';
    externalParticipants.forEach(p => {
      context += `- ${p.name || 'Unknown'}\n`;
    });
    context += '\n';
  }

  const internalParticipants = getInternalParticipants(participants);
  if (internalParticipants.length > 0) {
    context += '**Internal Participants (Spiralyze Team):**\n';
    internalParticipants.forEach(p => {
      const name = p.canonicalName || p.name || 'Unknown';
      const role = p.role || 'Unknown';
      context += `- ${name} [${role}]\n`;
    });
  }

  return context;
}

// ADD this helper to ParticipantDetection.gs:

/**
 * Returns a canonical client key by looking up CLIENT_TEAM_MAP.
 * Useful for matching "AFC" and "American Family Care" as the same client.
 */
function getCanonicalClientKey(clientName) {
  if (!clientName) return '';
  const normalized = clientName.toLowerCase().trim().replace(/[\s\-_]+/g, '');

  // Direct match
  const keys = Object.keys(CLIENT_TEAM_MAP);
  for (var i = 0; i < keys.length; i++) {
    const key = keys[i];
    const keyNorm = key.replace(/[\s\-_]+/g, '');
    if (keyNorm === normalized || normalized.includes(keyNorm) || keyNorm.includes(normalized)) {
      return key; // return the canonical map key
    }
  }
  return clientName.toLowerCase().trim();
}