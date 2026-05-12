/**
 * Seed script. Run after `npm run db:push`:
 *   npm run db:seed
 *
 * Inserts 5 sample clients with their full normalized child rows. Idempotent
 * by client name — safe to re-run.
 *
 * To reset entirely: `rm spiralfolio.db* && npx drizzle-kit push && npm run db:seed`.
 */
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import {
  clients,
  contacts,
  concerns,
  decisions,
  deliverables,
  documents,
  goals,
  icpProfile,
  calls,
  wins,
} from '../lib/db/schema';
import { nanoid } from '../lib/utils/nanoid';
import type { ClientBrain } from '../lib/db/brain';

const dbPath = process.env.DATABASE_URL ?? path.join(process.cwd(), 'spiralfolio.db');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
const db = drizzle(sqlite);

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

// Inline copy of importBrainIntoTables so we don't drag in 'server-only' here.
function importBrain(clientId: string, brain: ClientBrain, at: Date) {
  (brain.client_goals ?? []).forEach((text, i) => {
    db.insert(goals).values({ id: nanoid(), clientId, text, position: i, createdAt: at }).run();
  });
  for (const c of brain.client_contacts ?? []) {
    db.insert(contacts)
      .values({
        id: nanoid(),
        clientId,
        name: c.name,
        role: c.role ?? null,
        isApprover: !!c.is_approver,
        notes: c.notes ?? null,
        side: 'client',
        createdAt: at,
      })
      .run();
  }
  for (const c of brain.internal_team ?? []) {
    db.insert(contacts)
      .values({
        id: nanoid(),
        clientId,
        name: c.name,
        role: c.role ?? null,
        isApprover: !!c.is_approver,
        notes: c.notes ?? null,
        side: 'internal',
        createdAt: at,
      })
      .run();
  }
  for (const c of brain.open_concerns ?? []) {
    db.insert(concerns)
      .values({
        id: nanoid(),
        clientId,
        concern: c.concern,
        owner: c.owner ?? null,
        blockerFor: c.blocker_for ?? null,
        status: (c.status as 'open' | 'in-progress' | 'resolved') ?? 'open',
        createdAt: at,
      })
      .run();
  }
  for (const c of brain.resolved_concerns ?? []) {
    db.insert(concerns)
      .values({
        id: nanoid(),
        clientId,
        concern: c.concern,
        owner: c.owner ?? null,
        blockerFor: c.blocker_for ?? null,
        status: 'resolved',
        resolvedAt: at,
        createdAt: at,
      })
      .run();
  }
  for (const d of brain.our_deliverables ?? []) {
    db.insert(deliverables)
      .values({
        id: nanoid(),
        clientId,
        item: d.item,
        details: d.details ?? null,
        owner: d.owner ?? null,
        due: d.due ?? null,
        status: d.status ?? 'pending',
        side: 'us',
        createdAt: at,
        updatedAt: at,
      })
      .run();
  }
  for (const d of brain.client_deliverables ?? []) {
    db.insert(deliverables)
      .values({
        id: nanoid(),
        clientId,
        item: d.item,
        details: d.details ?? null,
        owner: d.owner ?? null,
        due: d.due ?? null,
        status: d.status ?? 'pending',
        side: 'client',
        createdAt: at,
        updatedAt: at,
      })
      .run();
  }
  for (const text of brain.decisions_made ?? []) {
    db.insert(decisions).values({ id: nanoid(), clientId, text, decidedAt: at }).run();
  }
  for (const text of brain.wins ?? []) {
    db.insert(wins).values({ id: nanoid(), clientId, text, wonAt: at }).run();
  }
  if (brain.icp_notes && Object.keys(brain.icp_notes).length > 0) {
    const icp = brain.icp_notes;
    db.insert(icpProfile)
      .values({
        clientId,
        primarySegment: icp.primary ?? null,
        secondarySegment: icp.secondary ?? null,
        motivators: JSON.stringify(icp.key_motivators ?? []),
        objections: JSON.stringify(icp.key_objections ?? []),
        demographicSignals: JSON.stringify(icp.demographic_signals ?? []),
        updatedAt: at,
      })
      .run();
  }
  for (const entry of brain.call_log ?? []) {
    db.insert(calls)
      .values({
        id: nanoid(),
        clientId,
        callDate: entry.date,
        callType: entry.type ?? null,
        callSummary: entry.summary ?? null,
        keyUpdates: JSON.stringify(entry.key_updates ?? []),
        attendeesClient: JSON.stringify(entry.attendees_client ?? []),
        attendeesInternal: JSON.stringify(entry.attendees_internal ?? []),
        status: 'done',
        createdAt: new Date(entry.date),
      })
      .run();
  }
}

type SeedClient = {
  name: string;
  engagement?: string;
  pmName?: string;
  adName?: string;
  status: string;
  successMetric?: string;
  brain: ClientBrain;
};

const SEEDS: SeedClient[] = [
  {
    name: '32Auctions',
    engagement: '32Auctions CRO Pilot',
    pmName: 'Arbab Gill',
    adName: 'Thomas Boyle',
    status: 'on-track',
    successMetric: 'New auctions with 1+ item and 3+ bids — confirms real engagement',
    brain: {
      client_goals: [
        'Increase auctions with at least 1 item and 3+ bids',
        'Simplify and reduce friction on the pricing page',
        'Reduce signup and onboarding drop-off',
        'Improve conversion from free to paid auctions',
        'Lean into education/school ICP and animal shelter segments',
      ],
      client_contacts: [
        { name: 'Shannon Gonzalez', role: 'VP Marketing', is_approver: true, notes: 'Primary daily contact for test approvals' },
        { name: 'Braxton', role: 'Director of Product', is_approver: true, notes: 'Builds Sigma reports, technical lead' },
        { name: 'Toby', role: 'CEO', is_approver: false, notes: 'Strategic input, sends Sigma invites' },
        { name: 'Von', role: 'Technical', is_approver: false, notes: 'Owns GTM deployment on client side' },
      ],
      internal_team: [
        { name: 'Arbab Gill', role: 'PM' },
        { name: 'Thomas Boyle', role: 'AD' },
        { name: 'Helen', role: 'Designer' },
        { name: 'Farouk', role: 'Engineer' },
      ],
      open_concerns: [
        { concern: 'GTM Verify not confirmed in staging', owner: 'Von', blocker_for: 'AA test launch', status: 'in-progress' },
        { concern: 'Pricing tier naming not finalized', owner: 'Braxton + Toby', blocker_for: 'Pricing page test build', status: 'open' },
      ],
      our_deliverables: [
        { item: 'Pricing page redesign test variant', details: 'Simplified tiers, anxiety reducers, decoy anchoring', status: 'in-progress' },
        { item: 'Signup flow test variant', details: 'Shorter form, optional fields deferred, Google/Apple auth prioritized', status: 'in-progress' },
        { item: 'Homepage redesign test variant', details: 'Product UI in hero, 3 pain points, use-case pills', status: 'in-progress' },
        { item: 'AA tests on live site', details: 'Target 70% coverage, begins once GTM confirmed', status: 'pending' },
      ],
      client_deliverables: [
        { item: 'Confirm pricing tier structure', owner: 'Braxton + Toby', due: 'before next call' },
        { item: 'Top 5 use case categories for homepage pills', owner: 'Shannon / Braxton', due: 'before homepage test build' },
        { item: 'Von to complete GTM Verify in staging', owner: 'Von', due: 'ASAP' },
        { item: 'Toby to send Sigma report access invites', owner: 'Toby', due: 'before first test launch' },
      ],
      decisions_made: [
        'Shannon is primary daily contact for approvals',
        'Pilot focuses on 32Auctions first — Readathon deferred',
        'Org description field removed from signup flow, surfaced post-onboarding',
        'Target first tests live by end of week of 2026-04-28',
      ],
      wins: [],
      icp_notes: {
        primary: 'PTO/PTA heads, school administrators',
        secondary: 'Animal shelters, arts organizations',
        key_motivators: ['Ease of use', 'Fast setup', 'No upfront credit card', 'Maximizing bids'],
        key_objections: ['Pricing page confusion', 'Transaction fees vs free competitors', 'No live phone support'],
        demographic_signals: [
          { signal: 'Most leads come from school newsletters', confirmed: false },
          { signal: 'Mobile usage > desktop for end-bidders', confirmed: true },
        ],
      },
      call_log: [
        {
          date: isoDaysAgo(20),
          type: 'kickoff',
          summary:
            'Strong kickoff. Aligned on success metric, reviewed first three test designs, confirmed contacts and approval process.',
          key_updates: [
            'Success metric defined: auctions with 1 item + 3 bids',
            'Shannon confirmed as primary test approval contact',
            'GTM Verify in progress — expected same-day resolution',
            'Three test designs presented, positive feedback received',
          ],
          attendees_client: ['Shannon Gonzalez', 'Braxton', 'Toby', 'Von', 'Sahil Patel'],
          attendees_internal: ['Thomas Boyle', 'Arbab Gill', 'Helen', 'Farouk'],
        },
      ],
    },
  },
  {
    name: 'Northwind Logistics',
    engagement: 'Northwind Acquisition',
    pmName: 'Priya Singh',
    adName: 'Thomas Boyle',
    status: 'at-risk',
    successMetric: 'Quote → booking conversion rate',
    brain: {
      client_goals: [
        'Lift checkout completion on the freight quote tool',
        'Cut quote-to-booking time by 30%',
      ],
      client_contacts: [
        { name: 'Marisol Vega', role: 'VP Growth', is_approver: true, notes: 'Strong opinions on copy.' },
        { name: 'Derek Tran', role: 'Engineering Lead', is_approver: false },
      ],
      internal_team: [
        { name: 'Priya Singh', role: 'PM' },
        { name: 'Thomas Boyle', role: 'AD' },
      ],
      open_concerns: [
        { concern: 'Legal review on quote disclaimers stalling launch', owner: 'Marisol', blocker_for: 'Quote tool A/B test', status: 'open' },
      ],
      our_deliverables: [
        { item: 'Freight quote redesign variant', details: 'Two-step → single-page', status: 'in-progress' },
        { item: 'Booking confirmation flow tweaks', status: 'pending' },
      ],
      client_deliverables: [
        { item: 'Approve revised quote disclaimer copy', owner: 'Marisol', due: isoDaysAgo(-2) },
        { item: 'Stage GTM container on freight subdomain', owner: 'Derek', due: 'ASAP' },
      ],
      decisions_made: ['Defer carrier comparison until phase 2'],
      wins: ['Quote page load time down 38% after first pass'],
      icp_notes: {
        primary: 'Mid-market shippers (10-200 loads/week)',
        key_motivators: ['Speed of quotes', 'Fewer follow-up emails', 'Predictable rates'],
        key_objections: ['Lock-in fears', 'Comparison shopping habits'],
      },
      call_log: [
        { date: isoDaysAgo(8), type: 'weekly', summary: 'Reviewed redesign comps. Legal flagged disclaimer language.', key_updates: ['Comps approved pending copy', 'GTM staging slipping'], attendees_client: ['Marisol Vega', 'Derek Tran'], attendees_internal: ['Priya Singh', 'Thomas Boyle'] },
        { date: isoDaysAgo(15), type: 'weekly', summary: 'Kicked off quote tool variant, scoped booking flow.', key_updates: ['Variant locked', 'Booking flow scoped'], attendees_client: ['Marisol Vega'], attendees_internal: ['Priya Singh'] },
        { date: isoDaysAgo(23), type: 'kickoff', summary: 'Kickoff. Aligned on goals and metric.', key_updates: ['Goals locked', 'Stakeholders mapped'], attendees_client: ['Marisol Vega', 'Derek Tran'], attendees_internal: ['Priya Singh', 'Thomas Boyle'] },
      ],
    },
  },
  {
    name: 'Helio Health',
    engagement: 'Helio Mobile App',
    pmName: 'Arbab Gill',
    adName: 'Marina Chen',
    status: 'blocked',
    successMetric: '7-day retention cohort lift',
    brain: {
      client_goals: ['Increase 7-day retention on the Helio iOS app', 'Reduce support tickets per active user'],
      client_contacts: [
        { name: 'Owen Reyes', role: 'Head of Product', is_approver: true },
        { name: 'Lila Patel', role: 'Compliance Lead', is_approver: true, notes: 'HIPAA gatekeeper.' },
      ],
      internal_team: [
        { name: 'Arbab Gill', role: 'PM' },
        { name: 'Marina Chen', role: 'AD' },
      ],
      open_concerns: [
        { concern: 'HIPAA review blocking onboarding test launch', owner: 'Lila', blocker_for: 'Onboarding A/B test', status: 'open' },
        { concern: 'iOS analytics SDK version mismatch', owner: 'Helio engineering', blocker_for: 'Conversion tracking', status: 'in-progress' },
      ],
      our_deliverables: [
        { item: 'Onboarding redesign variant', details: 'Cuts 3 screens, surfaces value prop earlier', status: 'pending' },
        { item: 'Push notification copy refresh', status: 'in-progress' },
      ],
      client_deliverables: [
        { item: 'Sign off on HIPAA-compliant copy', owner: 'Lila', due: 'this week' },
        { item: 'Upgrade analytics SDK to v8', owner: 'Helio engineering' },
      ],
      decisions_made: ['Hold all tests until HIPAA sign-off', 'Use server-side experiment assignment'],
      wins: [],
      icp_notes: {
        primary: 'Adults 40-65 managing chronic conditions',
        key_motivators: ['Privacy', 'Reminders', 'Family sharing'],
        key_objections: ['App fatigue', 'Data sharing concerns'],
      },
      call_log: [
        { date: isoDaysAgo(4), type: 'review', summary: 'Compliance review. Onboarding variant blocked pending HIPAA.', key_updates: ['Variant on hold', 'SDK upgrade scheduled'], attendees_client: ['Owen Reyes', 'Lila Patel'], attendees_internal: ['Arbab Gill', 'Marina Chen'] },
        { date: isoDaysAgo(11), type: 'weekly', summary: 'Walked through onboarding redesign rationale.', key_updates: ['Variant complete', 'Compliance review queued'], attendees_client: ['Owen Reyes'], attendees_internal: ['Arbab Gill'] },
      ],
    },
  },
  {
    name: 'Cobalt SaaS',
    engagement: 'Cobalt Pricing Refresh',
    pmName: 'Priya Singh',
    adName: 'Marina Chen',
    status: 'on-track',
    successMetric: 'Trial → paid in 14d',
    brain: {
      client_goals: ['Lift trial-to-paid conversion 15%', 'Reduce time-on-pricing-page'],
      client_contacts: [
        { name: 'Jasper Liu', role: 'CMO', is_approver: true },
        { name: 'Amy Goodwin', role: 'Growth PM', is_approver: false },
      ],
      internal_team: [
        { name: 'Priya Singh', role: 'PM' },
        { name: 'Marina Chen', role: 'AD' },
      ],
      our_deliverables: [
        { item: 'Pricing page rewrite', status: 'done' },
        { item: 'Plan comparison module', status: 'in-progress' },
      ],
      client_deliverables: [
        { item: 'Provide updated SOC2 logo assets', owner: 'Amy', due: 'next call' },
      ],
      decisions_made: ['Drop the Enterprise tier from public page', 'Run anchored-pricing variant first'],
      wins: ['Pricing page rewrite shipped 4 days early', 'Trial signups up 11% week-over-week'],
      icp_notes: { primary: 'Series A/B SaaS engineering teams', key_motivators: ['Self-serve', 'Predictable cost'] },
      call_log: [
        { date: isoDaysAgo(3), type: 'weekly', summary: 'Reviewed live pricing page metrics; promising signal.', key_updates: ['Trial signups +11%', 'Comparison module in design QA'], attendees_client: ['Jasper Liu', 'Amy Goodwin'], attendees_internal: ['Priya Singh', 'Marina Chen'] },
        { date: isoDaysAgo(10), type: 'weekly', summary: 'Pricing page launched.', key_updates: ['Launched', 'Started monitoring window'], attendees_client: ['Amy Goodwin'], attendees_internal: ['Priya Singh'] },
        { date: isoDaysAgo(18), type: 'review', summary: 'Final design review of pricing page.', key_updates: ['Design approved'], attendees_client: ['Jasper Liu'], attendees_internal: ['Priya Singh', 'Marina Chen'] },
        { date: isoDaysAgo(25), type: 'weekly', summary: 'Reviewed copy variants.', attendees_client: ['Amy Goodwin'], attendees_internal: ['Priya Singh'] },
        { date: isoDaysAgo(32), type: 'weekly', summary: 'Iterated on plan structure.', attendees_client: ['Jasper Liu', 'Amy Goodwin'], attendees_internal: ['Priya Singh'] },
      ],
    },
  },
  {
    name: 'Aurora Beauty',
    engagement: 'Aurora Lifecycle',
    pmName: 'Marcus Webb',
    adName: 'Thomas Boyle',
    status: 'on-track',
    successMetric: '90-day repeat purchase rate',
    brain: {
      client_goals: ['Re-engage lapsed subscribers', 'Increase repeat purchase rate'],
      client_contacts: [{ name: 'Sienna Ortiz', role: 'Lifecycle Lead', is_approver: true }],
      internal_team: [{ name: 'Marcus Webb', role: 'PM' }],
      open_concerns: [
        { concern: 'Klaviyo segment audit pending', owner: 'Sienna', blocker_for: 'Win-back campaign', status: 'open' },
      ],
      our_deliverables: [
        { item: 'Win-back email series concepts', status: 'pending' },
        { item: 'Onsite quiz for product matching', status: 'pending' },
      ],
      client_deliverables: [{ item: 'Audit Klaviyo segments and share export', owner: 'Sienna' }],
      decisions_made: ['Lead with sample-size offer in win-back'],
      wins: [],
      icp_notes: { primary: 'Women 25-45 lapsed subscribers', key_motivators: ['Value bundles', 'Curated picks'] },
      call_log: [
        { date: isoDaysAgo(28), type: 'weekly', summary: 'Aligned on win-back angle. Awaiting segment data.', attendees_client: ['Sienna Ortiz'], attendees_internal: ['Marcus Webb'] },
      ],
    },
  },
];

function main() {
  const now = new Date();
  for (const seed of SEEDS) {
    const existing = db.select().from(clients).where(eq(clients.name, seed.name)).get();
    if (existing) {
      console.log(`Already seeded: ${seed.name}`);
      continue;
    }
    const id = nanoid();
    db.insert(clients)
      .values({
        id,
        name: seed.name,
        engagement: seed.engagement ?? null,
        pmName: seed.pmName ?? null,
        adName: seed.adName ?? null,
        status: seed.status,
        successMetric: seed.successMetric ?? null,
        slackChannelId: null,
        asanaProjectId: null,
        driveFolderUrl: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    importBrain(id, seed.brain, now);
    console.log(`Seeded: ${seed.name} (${id})`);
  }
}

main();
