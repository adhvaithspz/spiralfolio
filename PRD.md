# Pulse — Client Intelligence Platform
### Cursor Build Prompt

---

## What We're Building

A web application called **Pulse** — a Client Intelligence Platform for agency PMs and Account Directors. It ingests Zoom call transcripts, maintains a living "project brain" per client, connects with Asana and Slack, and gives any internal stakeholder an instant grasp of any project at a glance.

---

## Core Concepts

### The Project Brain
Each project has one persistent JSON document that gets **updated** (not appended) after every call. It tracks:
- Client contacts and their roles/approver status
- Client goals and success metrics
- ICP notes
- Open concerns (with owners and blocker status)
- Our deliverables + client deliverables (both with statuses)
- Decisions made
- Wins
- Ingested documents from Google Drive
- Full call log

### Two AI Modes
1. **Per-call synthesis** — after each transcript, extract structured updates as JSON
2. **Project brain merge** — diff the new call output against the existing brain, return updated JSON

### Non-Negotiable Design Principle
Coaching/PM feedback is a **separate artifact, PM-gated only**. The project brain and all shared views contain **zero** performance evaluation language — no talk ratios, no scores, no critique. This is a project intelligence tool, not a staff evaluation tool.

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API routes
- **Database**: SQLite via **Drizzle ORM** — local file `pulse.db` in project root
- **Auth**: NextAuth.js with Google OAuth (or credentials for dev)
- **AI**: Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Integrations**: Slack API, Asana API, Google Drive API
- **File handling**: `better-sqlite3` as the SQLite driver

---

## Database Schema (Drizzle ORM — SQLite)

Create `/lib/db/schema.ts`:

```ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id:             text('id').primaryKey(),           // nanoid()
  name:           text('name').notNull(),
  clientName:     text('client_name').notNull(),
  pmName:         text('pm_name'),
  adName:         text('ad_name'),
  status:         text('status').default('on-track'), // on-track | at-risk | blocked | complete
  brain:          text('brain').notNull().default('{}'), // JSON stored as text
  slackChannelId: text('slack_channel_id'),
  asanaProjectId: text('asana_project_id'),
  driveFolderUrl: text('drive_folder_url'),
  createdAt:      integer('created_at', { mode: 'timestamp' }),
  updatedAt:      integer('updated_at', { mode: 'timestamp' }),
});

export const calls = sqliteTable('calls', {
  id:            text('id').primaryKey(),
  projectId:     text('project_id').references(() => projects.id),
  callDate:      text('call_date').notNull(),          // ISO date string
  callType:      text('call_type'),                    // kickoff | weekly | ad-hoc | review
  rawTranscript: text('raw_transcript'),
  coachingDoc:   text('coaching_doc'),                 // PM-only, never surfaced to stakeholders
  callSummary:   text('call_summary'),
  brainSnapshot: text('brain_snapshot'),               // JSON snapshot of brain at time of call
  status:        text('status').default('pending'),    // pending | processing | done | error
  createdAt:     integer('created_at', { mode: 'timestamp' }),
});

export const documents = sqliteTable('documents', {
  id:           text('id').primaryKey(),
  projectId:    text('project_id').references(() => projects.id),
  name:         text('name'),
  driveFileId:  text('drive_file_id'),
  docType:      text('doc_type'),
  keyFacts:     text('key_facts'),   // JSON array stored as text
  flags:        text('flags'),       // JSON array stored as text
  ingestedAt:   integer('ingested_at', { mode: 'timestamp' }),
});

export const users = sqliteTable('users', {
  id:        text('id').primaryKey(),
  email:     text('email').notNull().unique(),
  name:      text('name'),
  role:      text('role').default('stakeholder'), // admin | pm | ad | stakeholder
  createdAt: integer('created_at', { mode: 'timestamp' }),
});
```

Create `/lib/db/index.ts`:

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const sqlite = new Database('pulse.db');
export const db = drizzle(sqlite, { schema });
```

Create `drizzle.config.ts`:

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite',
  dbCredentials: { url: './pulse.db' },
} satisfies Config;
```

---

## File & Folder Structure

```
/app
  /dashboard                  — all-projects overview grid
  /projects
    /[id]
      /page.tsx               — project detail (tabbed)
      /calls/page.tsx         — call history + upload
      /documents/page.tsx     — ingested Drive docs
  /api
    /projects/route.ts        — GET all, POST create
    /projects/[id]/route.ts   — GET one, PATCH, DELETE
    /calls/process/route.ts   — main transcript processing endpoint
    /drive/ingest/route.ts    — Google Drive folder ingestion
    /slack/post/route.ts      — post digest to Slack channel
    /asana/sync/route.ts      — create Asana tasks from deliverables
    /briefing/route.ts        — generate quick AI briefing

/lib
  /db
    index.ts                  — Drizzle client
    schema.ts                 — table definitions
  /ai
    synthesis.ts              — per-call extraction prompt + Claude call
    merge.ts                  — brain merge prompt + Claude call
    briefing.ts               — quick briefing generation
    coaching.ts               — PM coaching doc (separate, gated)
    documents.ts              — document extraction prompt
  /integrations
    slack.ts
    asana.ts
    drive.ts
  /utils
    nanoid.ts                 — ID generation
    json.ts                   — safe JSON parse helpers

/components
  /project
    ProjectCard.tsx           — card for dashboard grid
    BrainTabs.tsx             — tabbed project view
    DeliverableBoard.tsx      — two-column our/their deliverables
    ContactList.tsx
    CallTimeline.tsx
    ICPPanel.tsx
    QuickBriefing.tsx         — AI briefing with copy-to-clipboard
  /calls
    TranscriptUploader.tsx
    ProcessingStatus.tsx      — step-by-step progress indicator
  /shared
    StatusBadge.tsx
    HealthIndicator.tsx
```

---

## Key API Routes

### `POST /api/calls/process`

**Input**: `{ project_id, transcript_text, call_date, call_type }`

**Pipeline** (run in order):
1. Load current project brain from `projects` table (`brain` column, parse JSON)
2. Run **synthesis prompt** → extract structured call facts as JSON
3. Run **merge prompt** → merge new facts into existing brain, return updated brain JSON
4. Run **coaching prompt** → generate PM-only coaching doc (saved separately, never returned to stakeholders)
5. Save updated brain back to `projects.brain`
6. Insert new row into `calls` table with `brain_snapshot` = updated brain
7. Fire-and-forget: post Slack digest, create Asana tasks
8. Return `{ updated_brain, call_id, changes_summary }`

### `POST /api/drive/ingest`

**Input**: `{ project_id, folder_url }`

**Pipeline**:
1. List all files in Drive folder via Drive API
2. For each file: export/download content based on MIME type
3. Run extraction prompt per document → get `{ key_facts, flags }` JSON
4. Insert rows into `documents` table
5. Merge doc summaries into `projects.brain` under `documents` array
6. Return `{ ingested: N, flags_found: N, docs: [...] }`

### `POST /api/slack/post`

**Input**: `{ project_id, call_id }`

Posts a clean stakeholder digest (never coaching content) to the project's Slack channel — see Slack section below for message format.

### `GET /api/briefing?project_id=xxx`

Fetches the current brain, runs the briefing prompt, returns `{ briefing: "..." }`.

---

## AI Prompts

### 1. Synthesis Prompt — `/lib/ai/synthesis.ts`

```
You are a client intelligence assistant at a CRO agency.

Extract structured facts from this call transcript. Return ONLY valid JSON, no commentary, no markdown fences.

Project: {project_name}
Client: {client_name}
Call type: {call_type}
Call date: {call_date}

Transcript:
{transcript}

Return this exact structure:
{
  "call_summary": "2-3 sentence summary of what happened on this call",
  "key_updates": ["...", "..."],
  "new_contacts": [{ "name": "", "role": "", "notes": "", "is_approver": false }],
  "resolved_concerns": ["exact wording of any previously open concerns that were closed"],
  "new_concerns": [{ "concern": "", "owner": "", "blocker_for": "", "status": "" }],
  "new_our_deliverables": [{ "item": "", "details": "", "status": "" }],
  "new_client_deliverables": [{ "item": "", "owner": "", "due": "" }],
  "updated_deliverables": [{ "item": "", "new_status": "" }],
  "decisions_made": ["..."],
  "wins": ["..."],
  "attendees_client": ["..."],
  "attendees_internal": ["..."]
}
```

### 2. Brain Merge Prompt — `/lib/ai/merge.ts`

```
You are updating a project brain document for a client account.

Current project brain:
{current_brain_json}

New call extraction:
{call_extraction_json}

Rules:
- Add new contacts; do not duplicate existing ones
- Move concerns from open_concerns to resolved_concerns if they appear in resolved_concerns list
- Add new_concerns to open_concerns
- Update deliverable statuses when updates are provided
- Append wins, decisions, and new deliverables
- Append this call to the call_log array
- Update last_updated and last_call fields to today's date
- Never delete information — only mark as resolved or update status

Return the complete updated project brain as valid JSON only. No commentary. No markdown fences.
```

### 3. Quick Briefing Prompt — `/lib/ai/briefing.ts`

```
You are briefing a stakeholder who needs a quick update on a client project.

Project brain:
{brain_json}

Write a 5-7 sentence plain English briefing covering:
1. What this project is and where we currently stand
2. The 1-2 most important open concerns or blockers right now
3. What we owe the client at the moment
4. What the client owes us
5. One thing worth knowing about the client relationship or dynamics

Tone: direct and clear, like a senior PM briefing a colleague before a meeting. No bullet points. No headers. Plain prose only.
```

### 4. Document Extraction Prompt — `/lib/ai/documents.ts`

```
You are extracting project-relevant facts from a client document.

Document name: {filename}
Project: {project_name}
Client: {client_name}

Document content:
{content}

Extract only facts a PM or AD would need when working this account:
- Stated goals, KPIs, or success criteria
- Timeline commitments or deadlines
- Budget signals or constraints
- Named stakeholders and their roles
- Technical constraints or requirements
- Anything that could become a concern or conflict later

Return ONLY valid JSON, no commentary:
{ "type": "contract|brief|audit|deck|other", "key_facts": ["..."], "flags": ["..."] }

Flags = facts that might conflict with other known information about this project.
Each fact must be under 20 words. Maximum 10 facts. Return ONLY valid JSON.
```

### 5. Coaching Prompt — `/lib/ai/coaching.ts` *(PM-gated only — never shown to stakeholders)*

```
You are a senior account coach reviewing a client call recording transcript.

Analyze this call for the PM's private development:
- Communication clarity and pacing
- How well goals and next steps were established
- Client engagement signals
- Areas where the PM handled things well
- 1-2 specific suggestions for the next call

This is private feedback for the PM only. Be specific, constructive, and direct.
Do not include scores, ratings, or performance metrics of any kind.

Transcript:
{transcript}
```

---

## UI Pages

### Dashboard `/dashboard`

Grid of project cards. Each card shows:
- Client name + project name
- PM + AD names
- Health status badge: `on-track` (green) / `at-risk` (yellow) / `blocked` (red) / `complete` (grey)
- Stats strip: goals count, open concerns, our pending deliverables, their pending deliverables
- Last call date + call count
- "Get Briefed" button → generates AI briefing in a popover, copy-to-clipboard

Top bar: search input + "New Project" button.
Filter bar: by status, PM, AD.

---

### Project View `/projects/[id]`

Tabbed layout — 6 tabs:

#### Overview
- Stats strip (goals, open concerns, our deliverables, client deliverables)
- Quick Briefing panel — AI-generated on demand, refresh button, copy to Slack button
- Open concerns list — each with: concern text, owner, what it's blocking, status badge
- Recent wins (if any)

#### Deliverables
- Two-column layout: **Our Deliverables** | **Client Deliverables**
- Each item: name, details, owner, status badge, due date if set
- Status badges: `in-progress` (blue) / `pending` (yellow) / `blocked` (red) / `done` (green)
- Counts in column headers

#### Contacts
- Card per contact: name, role, `APPROVER` badge if applicable, notes
- Grouped: Client Contacts | Internal Team

#### Call Log
- Timeline newest-first
- Each entry: date, type badge (kickoff/weekly/etc), summary, key updates list
- Click to expand full call detail
- "Upload New Transcript" button pinned at top

#### ICP Profile
- Primary + secondary ICP segments
- Key motivators
- Key objections / friction points
- Demographic signals with `unconfirmed` label where data is not verified

#### Documents
- List of ingested Drive documents
- Per doc: name, type badge, key facts list, flags (highlighted in amber if present)
- "Sync Drive Folder" button
- Drive folder URL input field

---

### Transcript Upload Flow

Step-by-step modal or page:
1. Paste or upload `.txt` transcript
2. Select call date (date picker) + call type (dropdown)
3. Submit → processing screen with live step indicators:
   - ⏳ Extracting call facts...
   - ⏳ Merging into project brain...
   - ⏳ Generating coaching doc... *(PM/AD only)*
   - ⏳ Posting Slack digest...
   - ⏳ Creating Asana tasks...
4. Completion screen: summary of what changed — new contacts found, concerns resolved, deliverables added

---

## Slack Message Format

Post to the project's linked Slack channel after every call:

```
📋 *{client_name} — {call_type} Update* | {date}

*Key updates from this call:*
• {update_1}
• {update_2}
• {update_3}

*Open concerns ({N}):*
{for each concern: ⚠️ concern — owner — blocking: X}

*We owe them:*
{for each pending our_deliverable: • item}

*They owe us:*
{for each pending client_deliverable: • item — owner — due: X}

<{app_url}/projects/{id}|View full project> · <{app_url}/api/briefing?project_id={id}|Get AI briefing>
```

**Important**: Never include coaching doc content in Slack messages. Stakeholder-visible only.

---

## Asana Integration — `/lib/integrations/asana.ts`

After each processed call, for each deliverable in `our_deliverables` with status not `done`:
- Create Asana task in the linked project
- Task name: deliverable item text
- Description: `{details}\n\nExtracted from {call_type} call — {call_date}`
- Due date: parsed from `due` field if present
- Tag with project name + client name

For `client_deliverables`, create tasks in a "Client Actions" section with a note indicating it's client-owned (for tracking purposes).

---

## Google Drive Integration — `/lib/integrations/drive.ts`

File type handling:

| File Type       | Export Method                          |
|-----------------|----------------------------------------|
| Google Doc      | Export as `text/plain` via Drive API   |
| Google Slides   | Export as `text/plain`                 |
| Google Sheet    | Export as `text/csv`                   |
| PDF             | Download, extract text with `pdf-parse`|
| DOCX            | Download, extract text with `mammoth`  |
| PPTX            | Download, extract text with `officeparser` |
| Images          | Skip (not worth ingesting)             |

Each document gets run through the extraction prompt. Store `key_facts` and `flags` as JSON strings in the `documents` table. Merge a summary version into `projects.brain` under a `documents` array.

---

## Access Control

| Role          | Can See                                      | Cannot See          |
|---------------|----------------------------------------------|---------------------|
| `admin`       | All projects, all views                      | Coaching docs       |
| `pm`          | Their projects, all views including coaching | —                   |
| `ad`          | Their projects, all views including coaching | —                   |
| `stakeholder` | Assigned projects, brain views only          | Coaching docs, ever |

Coaching docs (`calls.coaching_doc`) are **never** returned from any API route for `stakeholder` or `admin` roles. Gate at the API layer, not just the UI.

---

## Environment Variables

```bash
# AI
ANTHROPIC_API_KEY=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Integrations
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=
ASANA_ACCESS_TOKEN=
GOOGLE_SERVICE_ACCOUNT_JSON=   # stringified JSON of service account credentials

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Dependencies to Install

```bash
npm install drizzle-orm better-sqlite3 drizzle-kit
npm install @anthropic-ai/sdk
npm install next-auth
npm install @slack/web-api
npm install asana
npm install googleapis
npm install pdf-parse mammoth
npm install nanoid
npm install @radix-ui/react-tabs @radix-ui/react-dialog
npm install lucide-react
npm install clsx tailwind-merge
npm install -D @types/better-sqlite3
```

---

## Build Order

### Phase 1 — Core (build first, no integrations)
1. Install dependencies, set up Drizzle schema, run `drizzle-kit push`
2. Project CRUD API routes + dashboard UI with mock data
3. Project detail page with all 6 tabs (hardcode the 32Auctions brain JSON for initial UI dev)
4. Transcript upload flow + all 5 AI prompts wired to Claude API
5. Processing pipeline: synthesis → merge → save to SQLite

### Phase 2 — Integrations
6. Slack digest posting after each processed call
7. Asana task creation from deliverables
8. Google Drive folder ingestion

### Phase 3 — Auth + Polish
9. NextAuth setup with role-based access (coaching doc gating)
10. Real-time processing status updates (polling or SSE)
11. Search across all projects
12. Project health status manual override
13. Export project brain as PDF or Notion page

---

## Design Direction

**Aesthetic**: Clean, information-dense, utilitarian — built for professionals who live in this tool all day. Think Linear meets a project war room. Default to **dark mode**.

**Typography**: Geometric sans-serif for UI labels and stats (e.g. DM Mono or IBM Plex Mono for data values); clean readable sans for summaries and prose.

**Color system**:
- Background: `#0d0d0f` (near-black)
- Surface: `#17171a`
- Border: `#2a2a2e`
- Status green: `#22c55e`
- Status yellow: `#eab308`
- Status red: `#ef4444`
- Status blue: `#3b82f6`
- Accent: `#6366f1` (indigo — interactive elements only)
- Text primary: `#f4f4f5`
- Text muted: `#71717a`

**Principles**:
- Status must be scannable in under 2 seconds
- No decorative elements that don't carry information
- Every number on screen should answer a question the user was about to ask
- Hover states and transitions: subtle, 150ms max
- Empty states: give a clear action, not just an illustration

---

## Sample Project Brain JSON (seed data for dev)

Use this as your seed for the 32Auctions project during development:

```json
{
  "project_id": "32auctions-2026",
  "client": "32Auctions",
  "pm": "Arbab Gill",
  "ad": "Thomas Boyle",
  "status": "on-track",
  "last_updated": "2026-04-22",
  "last_call": "2026-04-22",
  "client_goals": [
    "Increase auctions with at least 1 item and 3+ bids",
    "Simplify and reduce friction on the pricing page",
    "Reduce signup and onboarding drop-off",
    "Improve conversion from free to paid auctions",
    "Lean into education/school ICP and animal shelter segments"
  ],
  "success_metric": "New auctions with 1+ item and 3+ bids — confirms real engagement",
  "client_contacts": [
    { "name": "Shannon Gonzalez", "role": "VP Marketing", "is_approver": true, "notes": "Primary daily contact for test approvals" },
    { "name": "Braxton", "role": "Director of Product", "is_approver": true, "notes": "Builds Sigma reports, technical lead" },
    { "name": "Toby", "role": "CEO", "is_approver": false, "notes": "Strategic input, sends Sigma invites" },
    { "name": "Von", "role": "Technical", "is_approver": false, "notes": "Owns GTM deployment on client side" }
  ],
  "open_concerns": [
    { "concern": "GTM Verify not confirmed in staging", "owner": "Von", "blocker_for": "AA test launch", "status": "in-progress" },
    { "concern": "Pricing tier naming not finalized", "owner": "Braxton + Toby", "blocker_for": "Pricing page test build", "status": "open" }
  ],
  "our_deliverables": [
    { "item": "Pricing page redesign test variant", "details": "Simplified tiers, anxiety reducers, decoy anchoring", "status": "in-progress" },
    { "item": "Signup flow test variant", "details": "Shorter form, optional fields deferred, Google/Apple auth prioritized", "status": "in-progress" },
    { "item": "Homepage redesign test variant", "details": "Product UI in hero, 3 pain points, use-case pills", "status": "in-progress" },
    { "item": "AA tests on live site", "details": "Target 70% coverage, begins once GTM confirmed", "status": "pending" }
  ],
  "client_deliverables": [
    { "item": "Confirm pricing tier structure", "owner": "Braxton + Toby", "due": "before next call" },
    { "item": "Top 5 use case categories for homepage pills", "owner": "Shannon / Braxton", "due": "before homepage test build" },
    { "item": "Von to complete GTM Verify in staging", "owner": "Von", "due": "ASAP" },
    { "item": "Toby to send Sigma report access invites", "owner": "Toby", "due": "before first test launch" }
  ],
  "decisions_made": [
    "Shannon is primary daily contact for approvals",
    "Pilot focuses on 32Auctions first — Readathon deferred",
    "Org description field removed from signup flow, surfaced post-onboarding",
    "Target first tests live by end of week of 2026-04-28"
  ],
  "wins": [],
  "icp_notes": {
    "primary": "PTO/PTA heads, school administrators",
    "secondary": "Animal shelters, arts organizations",
    "key_motivators": ["Ease of use", "Fast setup", "No upfront credit card", "Maximizing bids"],
    "key_objections": ["Pricing page confusion", "Transaction fees vs free competitors", "No live phone support"]
  },
  "documents": [],
  "call_log": [
    {
      "date": "2026-04-22",
      "type": "kickoff",
      "summary": "Strong kickoff. Aligned on success metric, reviewed first three test designs, confirmed contacts and approval process.",
      "key_updates": [
        "Success metric defined: auctions with 1 item + 3 bids",
        "Shannon confirmed as primary test approval contact",
        "GTM Verify in progress — expected same-day resolution",
        "Three test designs presented, positive feedback received"
      ],
      "attendees_client": ["Shannon Gonzalez", "Braxton", "Toby", "Von", "Sahil Patel"],
      "attendees_internal": ["Thomas Boyle", "Arbab Gill", "Helen", "Farouk"]
    }
  ]
}
```

---

*Last updated: May 2026 — build with Next.js 14, Drizzle ORM, SQLite (better-sqlite3), Claude API*