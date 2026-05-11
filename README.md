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
7. [Running it manually (for testing or backfill)](#7-running-it-manually-for-testing-or-backfill)
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
| `COACHING_FEEDBACK_DOC_IDS` | comma-separated Google Doc IDs used as calibration feedback for the AI |
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

## 7. Running it manually (for testing or backfill)

There are three manual entry points, all in the Apps Script editor's function dropdown:

### A) Run a specific call by meeting ID or topic fragment

Open `RunCall.js` and edit `RUN_CONFIG`:

```js
var RUN_CONFIG = {
  meetingId: '81072862648', // numeric ID OR a substring of the topic
  clientNameOverride: null,
  pmNameOverride: null,
  adNameOverride: null,
  ignorePreviousContext: false,
  forceExternal: false,
  callTypeOverride: null, // 'client_weekly' | 'design_review' | 'sales_call' | 'interview' | 'internal'
  skipDuplicateCheck: true,
};
```

Run `runCallByMeetingId()`. Logs stream to `View → Logs` and to the `Processing Log` sheet.

### B) Process the next unprocessed external client call

Run `testProcessNextExternalClientRecording()` from `Testing.js`. Useful for smoke-testing.

### C) Process a manually-pasted transcript (no Zoom recording)

Used for cases like the 32Auctions workaround. Paste the transcript into a Google Doc, then call `processManualTranscript()` from `ManualTranscript.js` with that doc's ID.

Other handy debug helpers in `Testing.js`:

- `listRecentExternalClientCalls()` — print recent recordings the system would have processed.
- `debugParticipantDetection()` — verify a specific call's PM/AD resolution.
- `isRecordingAlreadyProcessed(meetingId)` — has this been done before?

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
- **Calibration**: drop reviewer feedback as comments inside any coaching doc whose ID is listed in `COACHING_FEEDBACK_DOC_IDS`. The next run will read the latest reviewer feedback and adjust prompts accordingly (`extractFutureContextSummaryFromFeedback`).
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
