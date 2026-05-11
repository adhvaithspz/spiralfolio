# Spiralyze AI Call Coaching System

Automated post-call coaching for Spiralyze PMs and ADs.
Whenever a Zoom recording finishes, this system pulls the transcript, asks an LLM to grade it, writes a color-coded Google Doc with structured feedback, and DMs every Spiralyze attendee their personal coaching notes — all hands-off.

> **Status (May 2026):** live since 19 Apr 2026 · 55 coaching docs across 37 clients · 23 PM/AD Zoom accounts monitored · ~630 recordings/mo in scope · ~60s average per call.

---

## Table of Contents

1. [What this does](#1-what-this-does)
2. [End-to-end workflow](#2-end-to-end-workflow)
3. [Tech stack](#3-tech-stack)
4. [Repository layout](#4-repository-layout)
5. [Prerequisites](#5-prerequisites)
6. [Setup — step by step](#6-setup--step-by-step)
   - 6.1 [Clone and install tooling](#61-clone-and-install-tooling)
   - 6.2 [Connect to Apps Script via clasp](#62-connect-to-apps-script-via-clasp)
   - 6.3 [Create the Zoom Server-to-Server OAuth app](#63-create-the-zoom-server-to-server-oauth-app)
   - 6.4 [Create the Cloudflare Worker (webhook proxy)](#64-create-the-cloudflare-worker-webhook-proxy)
   - 6.5 [Create the Slack "Coaching Assistant" bot](#65-create-the-slack-coaching-assistant-bot)
   - 6.6 [Create AI provider keys](#66-create-ai-provider-keys)
   - 6.7 [Set Apps Script Script Properties](#67-set-apps-script-script-properties)
   - 6.8 [Initialize the Google Sheet & Drive folder](#68-initialize-the-google-sheet--drive-folder)
   - 6.9 [Deploy the Apps Script Web App](#69-deploy-the-apps-script-web-app)
   - 6.10 [Wire the Zoom webhook to the Worker](#610-wire-the-zoom-webhook-to-the-worker)
   - 6.11 [Install the time-based trigger](#611-install-the-time-based-trigger)
7. [Running manually & testing](#7-running-manually--testing)
   - 7.1 [Where to test: stage vs prod](#71-where-to-test-stage-vs-prod)
   - 7.2 [Sanity / config checks (run these first)](#72-sanity--config-checks-run-these-first)
   - 7.3 [Subsystem smoke tests](#73-subsystem-smoke-tests)
   - 7.4 [End-to-end tests (real call → real coaching doc)](#74-end-to-end-tests-real-call--real-coaching-doc)
   - 7.5 [Dry-run vs live-run patterns](#75-dry-run-vs-live-run-patterns)
   - 7.6 [Reading test output](#76-reading-test-output)
   - 7.7 [Common testing recipes](#77-common-testing-recipes)
8. [Configuration reference](#8-configuration-reference)
9. [Daily operations & maintenance](#9-daily-operations--maintenance)
10. [Troubleshooting](#10-troubleshooting)
11. [Credits](#11-credits)

---

## 1. What this does

For every external client call hosted by a Spiralyze PM or AD on Zoom, the system:

- Detects the call type (`client_weekly`, `design_review`, `sales_call`, `interview`, `internal`).
- Skips internal/non-client meetings automatically.
- Pulls the Zoom transcript (5-strategy download cascade for resilience).
- Resolves the client and the assigned PM/AD from `CLIENT_TEAM_MAP`.
- Loads historical context from the last N coaching docs for that client.
- Sends transcript + context to OpenAI (`gpt-4.1-mini`) — Claude is plug-and-play as a backup.
- Writes a Google Doc with:
  - Color-coded transcript
  - "What went well" then "What to improve" sections
  - Per-attendee feedback blocks
  - A `SUMMARY FOR FUTURE CONTEXT` block used by future runs
- DMs each Spiralyze attendee privately on Slack (transcript threaded under the DM).
- Logs the run into a Google Sheet (`Processing Log` and `Transcripts` tabs).

---

## 2. End-to-end workflow

```
Zoom call ends
      │
      ▼
Zoom fires recording.completed + recording.transcript_completed
      │
      ▼
Cloudflare Worker  ── validates HMAC-SHA256, returns 200 to Zoom in <1 ms
      │ (forwards payload)
      ▼
Apps Script doPost()
      │  - dedupes Zoom double-fires
      │  - skips internal calls by title
      │  - stores job under ScriptProperty WEBHOOK_JOB_{meetingId}_{date}
      ▼
Time-based trigger every 5 min → processWebhookJob()
      │
      ▼
processRecordingWithParticipants()
      │  - duplicate check
      │  - fetch participants
      │  - download transcript (5-strategy)
      │  - resolve PM/AD via CLIENT_TEAM_MAP
      │  - build historical-context bundle
      ▼
analyzeCallWithContext() → OpenAI /v1/responses (or Claude)
      │
      ▼
createBeautifulGoogleDoc()  → saved in COACHING_DOCS_FOLDER_ID
      │
      ▼
sendIndividualFeedbackDMs() → Slack DMs + threaded transcript
      │
      ▼
storeTranscriptWithDocLink() → row appended to "Transcripts" sheet
```

---

## 3. Tech stack

| Layer             | Tech                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| Backend logic     | Google Apps Script (V8 runtime, deployed as a Web App)               |
| Webhook receiver  | Cloudflare Worker (HMAC validation + forwarding)                     |
| Source recordings | Zoom Cloud Recording (Server-to-Server OAuth)                        |
| AI                | OpenAI `gpt-4.1-mini` (default) · Anthropic Claude Sonnet (optional) |
| Output store      | Google Drive (coaching docs) + Google Sheets (logs/transcripts)      |
| Notifications     | Slack Bot (`Coaching Assistant`, workspace-wide install)             |
| Local tooling     | Node + `@google/clasp` to push code, Prettier for formatting         |

---

## 4. Repository layout

```
call-coaching-feedback/
├─ appscript-library/               ← all Apps Script source (one .gs file per concern)
│  ├─ .clasp.json                   ← Apps Script project link (scriptId)
│  ├─ Code.js                       ← entry points: doPost(), processRecordingWithParticipants(),
│  │                                  createBeautifulGoogleDoc(), processWebhookJob(), …
│  ├─ RunCall.js                    ← manual runner: edit RUN_CONFIG.meetingId then run runCallByMeetingId()
│  ├─ ZoomAPI.js                    ← OAuth token cache, recordings list, 5-strategy transcript download, VTT parser
│  ├─ ClaudeAPI.js                  ← AI router (analyzeCallWithContext) + buildCoachingPrompt + 5 call-type templates
│  ├─ OpenAIAPI.js                  ← OpenAI provider (`/v1/responses`)
│  ├─ ParticipantDetection.js       ← Spiralyze staff matchers, CLIENT_TEAM_MAP, fuzzy client-key matching
│  ├─ ContextManagement.js          ← historical context bundle, prior-call summaries, reviewer feedback
│  ├─ SlackDM.js                    ← per-attendee DM sender, transcript-as-thread, handle map
│  ├─ ManualTranscript.js           ← processManualTranscript() (Google Doc → coaching) for non-Zoom calls
│  ├─ Testing.js                    ← test/debug helpers (testProcessNextExternalClientRecording, etc.)
│  ├─ Config.js                     ← CONFIG constants, AD/PM email lists, sheet bootstrappers
│  └─ Utils.js                      ← logToSheet, getTranscriptSheet, extractClientName, getUserRole, …
├─ appsscript.json                  ← Apps Script manifest (V8, Web App, IST timezone)
├─ Call_Coaching_Handover_Doc.pdf   ← original handover doc (source of truth for credentials & ops)
├─ package.json
├─ .prettierrc.json                 ← 2-space, single-quote, semi, 120 cols
└─ .vscode/                         ← editor config
```

> Apps Script renames `.js` → `.gs` on push. They're identical to the `.gs` files visible in the Apps Script editor.

---

## 5. Prerequisites

Before you start, make sure you have:

- A Google account that owns (or is a collaborator on) the Apps Script project.
- A Zoom account with admin rights to install Server-to-Server OAuth apps (Marketplace).
- A Cloudflare account (free tier is enough) to host the webhook Worker.
- A Slack workspace where you can install the `Coaching Assistant` bot.
- An OpenAI API key (and optionally an Anthropic key).
- Node.js 18+ and npm installed locally.
- Install clasp globally:
  ```bash
  npm install -g @google/clasp
  clasp login
  ```

---

## 6. Setup — step by step

If you're inheriting the existing system, **most of this is already done**. The handover steps below are the same path you'd take to recreate it from scratch.

### 6.1 Clone and install tooling

```bash
git clone https://github.com/Spiralyze-1/call-coaching-feedback.git
cd call-coaching-feedback
```

Optional but recommended:

```bash
npm install --global @google/clasp prettier
```

### 6.2 Connect to Apps Script via clasp

The repo already contains `appscript-library/.clasp.json` pointing at the live script:

```json
{ "scriptId": "141OcfY7tALor4vzcqWgPwWGK5Oqoyhy0YyD1_sjA-bOAoVxDnFOFO1cj" }
```

To push local changes to that project:

```bash
cd appscript-library
clasp login           # one-time, opens a browser
clasp push            # uploads .js files as .gs to Apps Script
clasp open            # opens the project in your browser
```

To create a brand new Apps Script project instead:

```bash
clasp create --type standalone --title "Spiralyze Call Coaching"
# replace the scriptId in .clasp.json with the new one
clasp push
```

### 6.3 Create the Zoom Server-to-Server OAuth app

1. Go to [marketplace.zoom.us](https://marketplace.zoom.us) → **Develop → Build App → Server-to-Server OAuth**.
2. Copy the **Account ID**, **Client ID**, and **Client Secret** (you'll paste these into Script Properties later).
3. Under **Scopes**, add:
   - `cloud_recording:read:list_user_recordings`
   - `meeting:read:list_past_participants`
4. Under **Feature → Event Subscriptions**:
   - Add subscription with endpoint = your Cloudflare Worker URL (set up next).
   - Subscribe to: `recording.completed`, `recording.transcript_completed`.
   - Copy the **Secret Token** — you'll paste it into the Worker and Script Properties.
5. **Activate** the app.

### 6.4 Create the Cloudflare Worker (webhook proxy)

The Worker exists for two reasons: (1) Zoom requires HMAC validation responses in <3s; Apps Script cold-start is slower, (2) Apps Script web apps don't expose their request body in a Zoom-friendly form for HMAC.

The current Worker lives at `https://zoom-coaching-webhook.siddarth-d6c.workers.dev/`.

To create your own:

1. `dash.cloudflare.com` → **Workers & Pages → Create → Worker**.
2. Replace the default code with a script that:
   - Verifies Zoom's `endpoint.url_validation` event using `ZOOM_WEBHOOK_SECRET_TOKEN` (HMAC-SHA256 of the plain token).
   - For other events, `fetch()` forwards the JSON body to `APPS_SCRIPT_URL` and returns HTTP 200 to Zoom immediately.
3. Under **Settings → Variables**, add:
   - `ZOOM_WEBHOOK_SECRET_TOKEN` — same value as in Zoom.
   - `APPS_SCRIPT_URL` — paste once you have the `/exec` URL from step 6.9.
4. Deploy and copy the public Worker URL.

### 6.5 Create the Slack "Coaching Assistant" bot

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**.
2. Name it `Coaching Assistant`, install in the Spiralyze workspace.
3. **OAuth & Permissions → Bot Token Scopes**:
   - `im:write`
   - `chat:write`
   - `users:read`
   - `users:read.email`
4. Install to workspace, copy the **Bot User OAuth Token** (starts with `xoxb-`).
5. The bot is workspace-wide — individual users do not need to install anything; they just need to have a valid `@spiralyze.com` email mapped in `SPIRALYZE_SLACK_HANDLES` inside `SlackDM.js`.

### 6.6 Create AI provider keys

- OpenAI: [platform.openai.com](https://platform.openai.com) → **API Keys → Create**. Default model is `gpt-4.1-mini` via `/v1/responses`.
- Anthropic (optional fallback): [console.anthropic.com](https://console.anthropic.com) → **API Keys**. Model: `claude-sonnet-4-20250514`. Switch by setting `CONFIG.AI_PROVIDER` to `'claude'` in `Config.js`.

### 6.7 Set Apps Script Script Properties

In the Apps Script editor: **Project Settings → Script Properties → Add script property**. Add the following:

| Key                         | Value                                                                  |
| --------------------------- | ---------------------------------------------------------------------- |
| `ZOOM_ACCOUNT_ID`           | from the Zoom S2S OAuth app                                            |
| `ZOOM_CLIENT_ID`            | from the Zoom S2S OAuth app                                            |
| `ZOOM_CLIENT_SECRET`        | from the Zoom S2S OAuth app                                            |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Zoom Event Subscriptions secret                                        |
| `OPENAI_API_KEY`            | OpenAI key                                                             |
| `CLAUDE_API_KEY`            | Anthropic key (optional)                                               |
| `SLACK_BOT_TOKEN`           | `xoxb-…`                                                               |
| `COACHING_DOCS_FOLDER_ID`   | ID of the Drive folder where coaching docs are saved                   |
| `COACHING_FEEDBACK_DOC_IDS` | comma-separated Google Doc IDs used as calibration feedback for the AI (current: `17wxDtxT8fuO6IgMtIvV8c1acxP9txp6-ztOv1_DOBBk` — [open doc](https://docs.google.com/document/d/17wxDtxT8fuO6IgMtIvV8c1acxP9txp6-ztOv1_DOBBk/edit)) |
| `SPREADSHEET_ID`            | ID of the Logs sheet (`Spiralyze Client Call Coaching - Logs`)         |

> **Never** hardcode any of these in source. The codebase reads everything from `PropertiesService.getScriptProperties()`.

### 6.8 Initialize the Google Sheet & Drive folder

1. In the Apps Script editor, run the function `initializeSheets()` once.
   - It creates the spreadsheet `Spiralyze Client Call Coaching - Logs` with two tabs: `Processing Log` and `Transcripts`.
   - It auto-saves the spreadsheet ID to `OUTPUT_SPREADSHEET_ID`.
   - Copy the URL into the `SPREADSHEET_ID` Script Property too (some helpers read from there).
2. Create a Drive folder named `Client Call Coaching - Transcripts & Feedback` and put its ID into `COACHING_DOCS_FOLDER_ID`.

### 6.9 Deploy the Apps Script Web App

1. **Deploy → Manage deployments → New deployment**.
2. Type: **Web app**.
3. **Execute as:** `Me`.
4. **Who has access:** `Anyone` (anonymous; Zoom signs requests via the Worker).
5. Click **Deploy** and copy the `/exec` URL.
6. Paste that URL into your Cloudflare Worker `APPS_SCRIPT_URL` env var.

> Whenever you push code changes that affect `doPost`, you **must** redeploy: **Deploy → Manage → Edit → New version → Deploy**. New URLs are NOT generated when you keep the same deployment ID.

### 6.10 Wire the Zoom webhook to the Worker

Back in the Zoom Marketplace app:

1. Set the webhook endpoint URL to your Cloudflare Worker URL.
2. Validate. Zoom sends an `endpoint.url_validation` event; the Worker should respond with the expected HMAC.
3. Confirm the two events are subscribed (`recording.completed`, `recording.transcript_completed`).

### 6.11 Install the time-based trigger

In the Apps Script editor:

1. **Triggers (clock icon) → Add Trigger**.
2. Function: `processWebhookJob`.
3. Event source: **Time-driven**.
4. Type: **Minutes timer**, every **5 minutes**.
5. Save.

This trigger drains the queue of `WEBHOOK_JOB_*` ScriptProperties stored by `doPost()`.

---

## 7. Running manually & testing

All test entry points live in `Testing.js`, `RunCall.js`, and `ManualTranscript.js`. To run any of them: open the Apps Script editor (`clasp open` from the right folder), pick the function name from the dropdown next to the **Run** button, and click **Run**. Output streams to **View → Logs** (Apps Script's Stackdriver) and to the **Processing Log** tab of the Logs sheet (every helper calls `logToSheet`).

### 7.1 Where to test: stage vs prod

We maintain two Apps Script projects with identical source:

| Env       | Folder                     | scriptId                                                                                | Use it for                            |
| --------- | -------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------- |
| **prod**  | `appscript-library/`       | `141OcfY7tALor4vzcqWgPwWGK5Oqoyhy0YyD1_sjA-bOAoVxDnFOFO1cj`                              | Live Zoom traffic + the 5-min trigger |
| **stage** | `appscript-library-stage/` | `11Xs8dXDu0sMnmzB4jcDIyvWdsKq2VFSVEpjpJGiih4zz__8k0a7AUoeF` ([open](https://script.google.com/d/11Xs8dXDu0sMnmzB4jcDIyvWdsKq2VFSVEpjpJGiih4zz__8k0a7AUoeF/edit)) | All testing & experiments             |

Rules of thumb:

- **Always test invasive code changes in stage first.** Stage has its own Script Properties — point it at a separate Logs sheet, a separate Drive folder, and (recommended) a sandbox Slack bot. That way prod data and prod attendees are never touched by a test.
- Stage trigger is **off by default.** Test runs in stage are explicit — they only happen when you click Run.
- Promote tested changes to prod with `npm run sync:to-prod` (see [sync script](#sync-script)). It shows a diff, asks for confirmation, then offers to `clasp push` and reminds you to redeploy.

```bash
# Sync workflow
npm run sync:diff        # see what's different between trees
npm run sync:to-stage    # baseline stage from prod before starting work
npm run sync:to-prod     # promote stage -> prod when tests pass
```

### 7.2 Sanity / config checks (run these first)

These never touch transcripts or Slack. They prove the environment is wired up correctly.

| Function                          | What it verifies                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `testInitializeSpreadsheet()`     | Creates the Logs spreadsheet (`Processing Log` + `Transcripts` tabs), prints its URL.         |
| `getSheetUrl()`                   | Prints the URL of the active Logs spreadsheet so you know where logs land.                    |
| `testActiveAIProvider()`          | Logs `AI_PROVIDER`, both model names, and the `ENABLE_SLACK_POSTING` flag.                    |
| `testCalibrationDocAccess()`      | Opens every Doc ID in `COACHING_FEEDBACK_DOC_IDS` and prints title + first 300 chars. Should NOT log `FAILED for …` — if it does, the doc is unshared or wrong-typed. |
| `testReviewerFeedbackContext()`   | Prints the first ~2k chars of compiled reviewer feedback that the next AI run will receive.   |
| `testOpenAIConnection()`          | Sends a built-in sample transcript through OpenAI and logs the AI's feedback. Confirms `OPENAI_API_KEY` + quota + prompt assembly are healthy. |

If any of these fail, **stop and fix Script Properties before running anything else**. The expensive E2E tests below will fail in confusing ways otherwise.

### 7.3 Subsystem smoke tests

These call live Zoom / classification logic but do **not** generate coaching docs or DMs.

| Function                                 | What it does                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `testListPMsAndADs()`                    | Fetches all Spiralyze PM/AD Zoom users via the S2S OAuth token. Proves Zoom creds + scopes.        |
| `testFetchAllRecordings()`               | Lists recent recordings and flags which have transcripts. Proves Zoom `list_user_recordings` works. |
| `testClientNameExtraction()`             | Runs `extractClientName()` on a hardcoded list of meeting titles. Sanity check for regex patterns. |
| `debugParticipantDetection()`            | For each of the 15 most-recent recordings: lists participants, classifies them INTERNAL/CLIENT, prints `extractClientName` output. Best tool for diagnosing "PM/AD = unknown". |
| `listRecentExternalClientCalls(limit)`   | Like above but only prints calls the pipeline would actually act on. Default `limit=20`.           |
| `isRecordingAlreadyProcessed(recording)` | Pass a recording object — returns `true` if a row with the same meetingId+date or client+date already exists in `Transcripts`. |

### 7.4 End-to-end tests (real call → real coaching doc)

These run the **full pipeline**: download transcript → call OpenAI → write Google Doc → log to sheet → (optionally) DM Slack.

#### A) Run a specific call by meeting ID or topic fragment — `runCallByMeetingId()`

Open `RunCall.js` and edit `RUN_CONFIG`, then run `runCallByMeetingId()`:

```js
var RUN_CONFIG = {
  meetingId: '81072862648', // numeric ID OR a substring of the topic (case-insensitive)
  clientNameOverride: null, // force a client name
  pmNameOverride: null,     // force a PM display name
  adNameOverride: null,     // force an AD display name
  ignorePreviousContext: false, // true = skip historical context bundle
  forceExternal: false,         // true = bypass internal/external classifier
  callTypeOverride: null,       // 'client_weekly' | 'design_review' | 'sales_call' | 'interview' | 'internal'
  skipDuplicateCheck: true,     // true = re-process even if already in Transcripts
};
```

This is the **primary** test entry point — it gives you full control over a single run and is the only path that respects the overrides above.

#### B) Process the next unprocessed external client call — `testProcessNextExternalClientRecording()`

Walks the recent-recordings list, filters to external client calls without a row in `Transcripts`, sorts newest-first, and runs the pipeline on the first one that succeeds. Use this as a one-click "did anything regress?" check after a deploy.

#### C) Process the most recent recording (no filters) — `testProcessMostRecentRecording()`

Picks recordings[0] unconditionally and runs `processClientCall(id, topic)` on it. Cruder than (B) but useful if (B) reports "no candidates".

#### D) Process a manually-pasted transcript — `processManualTranscript({...})`

For non-Zoom transcripts (Otter, MS Teams export, the 32Auctions workaround, etc.). Paste the transcript into a Google Doc, then call:

```js
processManualTranscript({
  meetingTopic: '32Auctions <> Spiralyze - Weekly CRO',
  hostEmail: 'arbab@spiralyze.com',
  meetingDate: '2026-04-29T22:30:00',
  transcriptText: readTranscriptTextFromDrive('1wqTbTq63-CZJDItp3CZ54ITEtvCK6BtvGBh67Fptvh0'),
  ignorePreviousContext: true,
});
```

Pre-baked example: `testProcess32AuctionsTranscriptFromGoogleDoc()`. To preview parsing without running the AI: `testParse32AuctionsTranscriptFromGoogleDoc()`.

#### E) Pinned regression cases

`Testing.js` has named regression entry points kept around because they cover edge cases:

- `testProcessCandelaWeeklyMeeting()` — exercises `forceExternal` + `clientNameOverride` against a known meeting ID.
- `processSpecificRecordingWithoutPreviousContext(meetingId, meetingUuid, topic, hostEmail)` — runs E2E with **no** historical context and Slack disabled (good for evaluating prompt changes in isolation).

### 7.5 Dry-run vs live-run patterns

Combine these flags to control blast radius:

| Goal                                                  | How                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Generate a coaching doc but **don't** DM anyone       | Set `CONFIG.ENABLE_SLACK_POSTING = false` in `Config.js` (or set the same on stage env). |
| Re-process a call that's already in `Transcripts`     | `RUN_CONFIG.skipDuplicateCheck = true`.                                                  |
| Isolate prompt changes from historical context        | `RUN_CONFIG.ignorePreviousContext = true`.                                               |
| Test on an internal-looking title (e.g. "team sync")  | `RUN_CONFIG.forceExternal = true`.                                                       |
| Test a specific template (`design_review` etc.)       | `RUN_CONFIG.callTypeOverride = 'design_review'`.                                         |
| Run against prod data without touching prod resources | Use the stage env (separate Drive folder + Logs sheet + Slack bot).                      |

> **Safety:** `ENABLE_SLACK_POSTING` is the master switch. Flip it to `false` in stage's `Config.js` and commit it — that way no one accidentally DMs prod attendees from stage. Flip via Script Properties is not supported; it's a code constant.

### 7.6 Reading test output

- **Apps Script editor** → bottom panel `Execution log` shows `Logger.log(...)` lines from the most recent run.
- **Apps Script editor** → left sidebar `Executions` shows every invocation, status, duration, and the user who ran it. Click a row → see its full log.
- **Logs sheet → `Processing Log` tab** — every helper writes here via `logToSheet`. Rows are color-coded by status:
  - 🟢 `SUCCESS` — pipeline completed
  - 🔴 `ERROR` / `TEST FAILED` — something threw; the error column has the stack
  - 🟡 `WARNING` — recoverable issue (e.g. participant resolved but client unknown)
  - ⚫ `SKIPPED` — duplicate or non-external
  - 🔵 `STARTED` / `INFO` — progress checkpoints
  - 🟣 `TEST` / `TEST COMPLETE` — `testFoo()` book-end rows
- **Logs sheet → `Transcripts` tab** — one row per successfully processed call, with link to the coaching doc. This is what `isRecordingAlreadyProcessed()` reads.
- **Coaching docs** — every successful run ends in a Google Doc in `COACHING_DOCS_FOLDER_ID`. The last block is `SUMMARY FOR FUTURE CONTEXT`; that's what the next run on the same client will pick up.

### 7.7 Common testing recipes

**Smoke test after a code deploy (stage):**

```text
1. cd appscript-library-stage && clasp push
2. testActiveAIProvider()              → confirms wiring
3. testCalibrationDocAccess()          → confirms calibration doc still readable
4. testProcessNextExternalClientRecording()  → real E2E on prod-like data
5. Eyeball the resulting coaching doc + Processing Log row
```

**Replay a specific historical call (e.g. customer asked us to re-run a doc):**

```text
1. RUN_CONFIG.meetingId = '<that meeting id>'
2. RUN_CONFIG.skipDuplicateCheck = true
3. RUN_CONFIG.ignorePreviousContext = true   // optional: ignore prior coaching docs
4. runCallByMeetingId()
```

**Diagnose "Doc says PM/AD = unknown":**

```text
1. debugParticipantDetection()         → inspect the offending recording
2. If participant name is right but role lookup is wrong:
     - Add the email to PM_EMAILS / AD_EMAILS in Config.js
     - Or add an entry in CLIENT_TEAM_MAP in ParticipantDetection.js
3. Re-run via runCallByMeetingId() with skipDuplicateCheck=true
```

**Iterate on a prompt change without spending OpenAI quota on full transcripts:**

```text
1. Edit prompt in ClaudeAPI.js / OpenAIAPI.js
2. testOpenAIConnection()              → uses the built-in sample transcript
3. Inspect the logged feedback
4. Once happy, run testProcessNextExternalClientRecording() once for a real-data check
```

**Validate the manual-transcript path (no Zoom recording available):**

```text
1. Paste transcript text into a fresh Google Doc, copy its ID
2. testParse32AuctionsTranscriptFromGoogleDoc()  // first, just preview parsing
3. processManualTranscript({ meetingTopic, hostEmail, meetingDate, transcriptText, ignorePreviousContext: true })
```

<a id="sync-script"></a>

> See `scripts/sync-stage.sh` for promoting code between the two environments. The script is wrapped by `npm run sync:diff | sync:to-stage | sync:to-prod` and always previews the diff + asks for confirmation before writing anything.

---

## 8. Configuration reference

`Config.js` exposes:

```js
const CONFIG = {
  AI_PROVIDER: 'openai', // 'openai' | 'claude'
  OPENAI_MODEL: 'gpt-4.1-mini',
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 4096,
  MAX_PREVIOUS_CALLS: 3, // how many prior coaching docs to inject as context
  MAX_REVIEWER_FEEDBACK_CHARS_PER_DOC: 6000,
  MAX_REVIEWER_FEEDBACK_TOTAL_CHARS: 12000,
  ENABLE_SLACK_POSTING: true, // set false for dry runs
  SLACK_MESSAGE_CHAR_LIMIT: 3000,
  OUTPUT_SHEET_NAME: 'Processing Log',
  TRANSCRIPT_SHEET_NAME: 'Transcripts',
  SPREADSHEET_NAME: 'Spiralyze Client Call Coaching - Logs',
  CLIENT_PATTERNS: [
    /* regexes for parsing client name from meeting topic */
  ],
};
```

PM/AD rosters live as `PM_EMAILS` and `AD_EMAILS` in the same file. Add or remove people there. Slack handle ↔ email mapping lives in `SPIRALYZE_SLACK_HANDLES` inside `SlackDM.js`. Client → AD/PM mapping lives in `CLIENT_TEAM_MAP` inside `ParticipantDetection.js`.

---

## 9. Daily operations & maintenance

- **Where to look first**: the `Processing Log` tab in the Logs Sheet. Color-coded rows (green = success, red = error, yellow = warning, grey = skipped, blue = started).
- **Coaching docs**: in the `COACHING_DOCS_FOLDER_ID` Drive folder. Each doc ends with a `SUMMARY FOR FUTURE CONTEXT` block — keep the last few; that's what feeds the next run's context.
- **Calibration**: drop reviewer feedback as comments inside any coaching doc whose ID is listed in `COACHING_FEEDBACK_DOC_IDS`. The next run will read the latest reviewer feedback and adjust prompts accordingly (`extractFutureContextSummaryFromFeedback`). The live calibration doc is [`Call Coaching - Calibration Feedback`](https://docs.google.com/document/d/17wxDtxT8fuO6IgMtIvV8c1acxP9txp6-ztOv1_DOBBk/edit) (ID `17wxDtxT8fuO6IgMtIvV8c1acxP9txp6-ztOv1_DOBBk`).
- **Adding a new PM / AD**: add their email to `PM_EMAILS` or `AD_EMAILS` in `Config.js`, add them to the workspace bot's reachable users in Slack, and add an entry in `SPIRALYZE_SLACK_HANDLES`. `clasp push` and redeploy.
- **Re-deploying after code changes**: always **Deploy → Manage → Edit → New version → Deploy**.

---

## 10. Troubleshooting

| Symptom                                | Likely cause / fix                                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zoom marks webhook as unverified       | The Worker isn't returning the right HMAC. Check `ZOOM_WEBHOOK_SECRET_TOKEN` is identical in Zoom and Cloudflare.                                        |
| Calls never get processed              | Time-based trigger is missing — re-add for `processWebhookJob` every 5 minutes. Or jobs are stuck in ScriptProperties.                                   |
| `Bandwidth quota exceeded` in logs     | Expected on big bursts. `processWithRetry()` waits 40s and retries up to 2 times. Re-run via `runCallByMeetingId()` if it still fails.                   |
| Coaching doc generated but no Slack DM | `ENABLE_SLACK_POSTING` is false, the user isn't in `SPIRALYZE_SLACK_HANDLES`, or `SLACK_BOT_TOKEN` is missing/expired.                                   |
| Doc says PM/AD = unknown               | Add the email to `CLIENT_TEAM_MAP` in `ParticipantDetection.js`, or add to `PM_EMAILS`/`AD_EMAILS` in `Config.js`.                                       |
| Transcript download fails              | `fetchZoomDownloadText()` runs 5 strategies in order — check the row's Error column. If still failing, fall back to `processManualTranscript()`.         |
| Duplicate runs after re-deploying      | Each meeting writes a `WEBHOOK_JOB_{meetingId}_{date}` ScriptProperty. `isRecordingAlreadyProcessed()` also blocks duplicates. Manually clear if needed. |

---

## 11. Credits

Built and maintained by **Siddarth Todi** and **Adhvaith Kul** at Spiralyze.
