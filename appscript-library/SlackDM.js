// ═══════════════════════════════════════════════════════════════
//  SlackDM.gs — Individual coaching DMs + transcript thread
// ═══════════════════════════════════════════════════════════════

/**
 * SPIRALYZE_SLACK_HANDLES
 * Maps canonical name → Slack email.
 * Update as team members are added.
 */
const SPIRALYZE_SLACK_HANDLES = {
  // Leadership
  'Gajan Retnasaba':  { email: 'gajan@spiralyze.com' },
  'Sahil Patel':      { email: 'sahil@spiralyze.com' },
  'Yaseen':           { email: 'yaseen@spiralyze.com' },
  'Farouk Elmoursi':  { email: 'farouk@spiralyze.com' },
  // ADs
  'Daria Morozova':   { email: 'daria@spiralyze.com' },
  'Lazar Bojicic':    { email: 'lazarb@spiralyze.com', slackId: 'U04KC4NT2LD' },
  'Harry Vermeulen':  { email: 'harry@spiralyze.com' },
  'Thomas Boyle':     { email: 'thomas@spiralyze.com' },
  'Rashad':            { email: 'abdelrahman@spiralyze.com', slackId: 'U06LH3DGU73' },

  // PMs
  'Josh':             { email: 'josh@spiralyze.com' },
  'Joao':             { email: 'joao@spiralyze.com' },
  'Helen Regnier':    { email: 'helen@spiralyze.com' },
  'Sebastian Maier':  { email: 'sebastian@spiralyze.com' },
  'Beth Lund':        { email: 'beth@spiralyze.com' },
  'Nikita':           { email: 'nikita@spiralyze.com' },
  'Jack':             { email: 'jack@spiralyze.com' },
  'Eric':             { email: 'eric@spiralyze.com' },
  'Ray':              { email: 'ray@spiralyze.com' },
  'Jessica':          { email: 'jessica@spiralyze.com' },
  'Rafay':            { email: 'rafay@spiralyze.com' },
  'Bilal':            { email: 'bilal@spiralyze.com' },
  'Arbab':            { email: 'arbab@spiralyze.com' },
  'Tatiana':          { email: 'tatiana@spiralyze.com' },
  'Furqaan':          { email: 'furqaan@spiralyze.com' },
  'Sanan':            { email: 'sanan@spiralyze.com', slackId: 'U08DVMY7Q92' },
  // Design
  'Rebekah Sproul':   { email: 'rebekah@spiralyze.com' },
  // Other
  'Siddarth Todi':    { email: 'siddarth@spiralyze.com' },
};

// Slack hard limit per text block is 3000 — stay under it
var SLACK_MAX_BLOCK_CHARS      = 2900;
// Max chars per transcript chunk in thread replies
var SLACK_TRANSCRIPT_CHUNK_CHARS = 2700;


// ═══════════════════════════════════════════════════════════════
//  SECTION EXTRACTION
// ═══════════════════════════════════════════════════════════════

/**
 * Extract all INDIVIDUAL FEEDBACK sections from the full feedback text.
 * Returns an array of { name, content } objects.
 */
function extractIndividualFeedbackSections(feedback) {
  const sections = [];
  const lines    = feedback.split('\n');

  // Matches BOTH forms:
  // From raw feedback string: **INDIVIDUAL FEEDBACK — Sanan (PM)**
  // From Google Doc getText(): INDIVIDUAL FEEDBACK — Sanan (PM)
  const HEADING_RE = /^\*{0,2}INDIVIDUAL FEEDBACK\s*[—\-]\s*([^(*\n]+?)(?:\s*\([^)]*\))?\*{0,2}\s*$/i;

  let currentName  = null;
  let currentLines = [];

  for (var i = 0; i < lines.length; i++) {
    var line  = lines[i].trim();
    var match = line.match(HEADING_RE);

    if (match) {
      if (currentName && currentLines.length > 0) {
        sections.push({ name: currentName.trim(), content: currentLines.join('\n').trim() });
      }
      currentName  = match[1].trim();
      currentLines = [];
    } else if (currentName) {
      // Stop at next numbered section — handles both "**5. TEAM..." and "5. TEAM..."
      if (/^\*{0,2}\d+\./.test(line) && !/INDIVIDUAL FEEDBACK/i.test(line)) {
        sections.push({ name: currentName.trim(), content: currentLines.join('\n').trim() });
        currentName  = null;
        currentLines = [];
      } else {
        currentLines.push(line);
      }
    }
  }

  if (currentName && currentLines.length > 0) {
    sections.push({ name: currentName.trim(), content: currentLines.join('\n').trim() });
  }

  return sections;
}


// ═══════════════════════════════════════════════════════════════
//  SLACK API HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Look up Slack user ID by email.
 * Returns user ID string or null.
 */
function getSlackUserIdByEmail(email, slackToken) {
  if (!email) return null;

  // Check for hardcoded slackId first — skips API call entirely, zero quota cost
  var handleEntry = Object.values(SPIRALYZE_SLACK_HANDLES).find(function(h) {
    return h.email && h.email.toLowerCase() === email.toLowerCase();
  });
  if (handleEntry && handleEntry.slackId) {
    Logger.log('✅ Slack ID from handles map for ' + email);
    return handleEntry.slackId;
  }

  // Fall back to API lookup
  try {
    var response = UrlFetchApp.fetch(
      'https://slack.com/api/users.lookupByEmail?email=' + encodeURIComponent(email),
      { method: 'get', headers: { 'Authorization': 'Bearer ' + slackToken }, muteHttpExceptions: true }
    );
    var result = JSON.parse(response.getContentText());
    if (result.ok && result.user && result.user.id) return result.user.id;
    Logger.log('Slack user not found for ' + email + ': ' + (result.error || 'unknown'));
    return null;
  } catch (e) {
    Logger.log('Error looking up Slack user ' + email + ': ' + e);
    return null;
  }
}

/**
 * Open a Slack DM channel with a user.
 * Returns channel ID string or null.
 */
function openSlackDM(userId, slackToken) {
  try {
    var response = UrlFetchApp.fetch('https://slack.com/api/conversations.open', {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + slackToken, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ users: userId }),
      muteHttpExceptions: true
    });
    var result = JSON.parse(response.getContentText());
    if (result.ok && result.channel && result.channel.id) return result.channel.id;
    Logger.log('Could not open DM with ' + userId + ': ' + (result.error || 'unknown'));
    return null;
  } catch (e) {
    Logger.log('Error opening DM: ' + e);
    return null;
  }
}

/**
 * Core Slack message poster — handles both top-level messages and thread replies.
 * Returns { ok, ts }.
 *
 * @param {string}  channelId  - Slack channel or DM channel ID
 * @param {string}  fallback   - Plain-text fallback for push notifications
 * @param {Array}   blocks     - Slack Block Kit array
 * @param {string}  slackToken
 * @param {string}  threadTs   - If set, posts as a reply in that thread
 */
function postSlackMessage(channelId, fallback, blocks, slackToken, threadTs) {
  var payload = { channel: channelId, text: fallback, blocks: blocks };
  if (threadTs) payload.thread_ts = threadTs;

  try {
    var response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {
      method:  'post',
      headers: { 'Authorization': 'Bearer ' + slackToken, 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var result = JSON.parse(response.getContentText());
    if (!result.ok) Logger.log('Slack postMessage error: ' + result.error);
    return { ok: result.ok, ts: result.ts || null };
  } catch (e) {
    Logger.log('Error posting Slack message: ' + e);
    return { ok: false, ts: null };
  }
}


// ═══════════════════════════════════════════════════════════════
//  COACHING DM
// ═══════════════════════════════════════════════════════════════

/**
 * Send individual coaching feedback as a Slack DM.
 * Returns the message ts (needed for threading) or null on failure.
 */
function sendCoachingDM(channelId, recipientName, callDate, meetingTopic, bodyText, slackToken) {

  var introLine = '_This message was sent automatically by the Spiralyze Coaching Bot. ' +
                  'Questions? Reach out to Siddarth Todi._\n\n';

  // ── Convert bullet lines to numbered + bold key phrases ──────
  var numberedBody = convertToNumberedBold(bodyText);

  var maxBody      = SLACK_MAX_BLOCK_CHARS - introLine.length;
  var truncated    = numberedBody.length > maxBody
    ? numberedBody.substring(0, maxBody) + '\n\n_[Full feedback in the coaching doc]_'
    : numberedBody;
  var bodyWithIntro = introLine + truncated;

  // ── Header line shown at the top of the DM ───────────────────
  // Format: "Coaching Feedback for Beth | Fleetio <> SPZ | Apr 27, 2026"
  var dateShort = callDate
    ? new Date(callDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  var headerLine = 'Coaching Feedback for ' + recipientName +
                   ' | ' + meetingTopic +
                   (dateShort ? ' | ' + dateShort : '');

  // ── Terminal log ──────────────────────────────────────────────
  Logger.log('  ┌─ SLACK MESSAGE ────────────────────────────────');
  Logger.log('  │ To:     ' + recipientName + ' (' + (dateShort || 'date unknown') + ')');
  Logger.log('  │ Call:   ' + meetingTopic);
  Logger.log('  │ Intro:  [Bot auto-message line]');
  Logger.log('  │ Body:');
  numberedBody.split('\n').forEach(function(line) {
    if (line.trim()) Logger.log('  │   ' + line.trim());
  });
  Logger.log('  └────────────────────────────────────────────────');

  var blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🎯 Your Coaching Feedback', emoji: true }
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*' + headerLine + '*' }
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: bodyWithIntro }
    }
  ];

  var result = postSlackMessage(channelId, headerLine, blocks, slackToken, null);
  return result.ok ? result.ts : null;
}



// ═══════════════════════════════════════════════════════════════
//  TRANSCRIPT THREAD
// ═══════════════════════════════════════════════════════════════

/**
 * Split transcript into chunks that fit Slack's block character limit.
 * Splits on newlines so no line is cut mid-sentence.
 */
function splitTranscriptIntoChunks(transcript, maxChars) {
  var lines  = transcript.split('\n');
  var chunks = [];
  var current = '';

  lines.forEach(function(line) {
    if (current.length + line.length + 1 > maxChars) {
      if (current.trim()) chunks.push(current.trim());
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  });

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/**
 * Send the full call transcript as thread replies under a coaching DM.
 * Long transcripts are split across multiple thread messages automatically.
 *
 * @param {string} channelId    - Same DM channel as the coaching message
 * @param {string} parentTs     - ts of the coaching DM (thread parent)
 * @param {string} transcript   - Raw transcript text
 * @param {string} meetingTopic - Used in the thread header label
 * @param {string} slackToken
 */
function sendTranscriptAsThread(channelId, parentTs, transcript, meetingTopic, slackToken) {
  if (!parentTs) {
    Logger.log('No parent ts — cannot thread transcript');
    return;
  }
  if (!transcript || !transcript.trim()) {
    Logger.log('Empty transcript — skipping thread');
    return;
  }

  // Slack code block wrapper adds ~6 chars — account for it
  var WRAPPER_OVERHEAD = 6;
  var MAX_CONTENT      = SLACK_TRANSCRIPT_CHUNK_CHARS - WRAPPER_OVERHEAD;

  // Try to send as a single message first
  if (transcript.trim().length <= MAX_CONTENT) {
    var singleBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*📋 Full Call Transcript — ' + meetingTopic + '*'
        }
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '```' + transcript.trim() + '```' }
      }
    ];

    var result = postSlackMessage(
      channelId, 'Full transcript: ' + meetingTopic,
      singleBlocks, slackToken, parentTs
    );

    if (result.ok) {
      Logger.log('  ✅  Transcript sent as single thread message');
      return;
    }
    // If single send failed, fall through to chunked
    Logger.log('  Single transcript message failed — falling back to chunks');
  }

  // ── Chunked fallback for long transcripts ─────────────────────
  var chunks = splitTranscriptIntoChunks(transcript, MAX_CONTENT);
  var total  = chunks.length;

  Logger.log('  Transcript split into ' + total + ' chunk(s)');

  chunks.forEach(function(chunk, idx) {
    var blocks;

    if (idx === 0) {
      blocks = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📋 Full Call Transcript — ' + meetingTopic + '*' +
                  '  _(part 1 of ' + total + ')_'
          }
        },
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '```' + chunk + '```' }
        }
      ];
    } else {
      blocks = [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '_part ' + (idx + 1) + ' of ' + total + '_' }
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '```' + chunk + '```' }
        }
      ];
    }

    var res = postSlackMessage(
      channelId, 'Transcript part ' + (idx + 1) + ' of ' + total,
      blocks, slackToken, parentTs
    );

    if (!res.ok) Logger.log('Failed to post transcript chunk ' + (idx + 1));
    if (idx < total - 1) Utilities.sleep(700);
  });
}


// ═══════════════════════════════════════════════════════════════
//  MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════

/**
 * Extract individual feedback sections and send each as a DM,
 * with the transcript threaded under each coaching message.
 *
 * Called from processRecordingWithParticipants in Code.gs.
 *
 * @param {string}  feedback      - Full AI coaching text
 * @param {string}  meetingTopic  - Meeting title
 * @param {string}  docUrl        - Google Doc link (shown as button)
 * @param {string}  transcript    - Raw transcript (pass null to skip threading)
 * @param {Object}  [ctx]         - Optional context for SpiralFolio event log:
 *                                  { clientName, meetingId, docUrl }
 */
function sendIndividualFeedbackDMs(feedback, meetingTopic, transcript, callDate, ctx) {
  ctx = ctx || {};
  var slackToken = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  if (!slackToken) {
    Logger.log('⚠️ SLACK_BOT_TOKEN not set — skipping DMs');
    return;
  }

  var sections = extractIndividualFeedbackSections(feedback);
  if (sections.length === 0) {
    Logger.log('No INDIVIDUAL FEEDBACK sections found — no DMs sent');
    return;
  }

  // Format call date once — used in every DM header
  var formattedDate = '';
  if (callDate) {
    try {
      formattedDate = new Date(callDate).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) {
      formattedDate = String(callDate).substring(0, 10);
    }
  }

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📨 SLACK DM DISPATCH — ' + meetingTopic);
  Logger.log('   Date: ' + (formattedDate || 'unknown'));
  Logger.log('   Recipients found: ' + sections.length);
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  var sent    = 0;
  var skipped = 0;
  var failed  = 0;

  var NO_COACHING_MARKERS = [
    'transcript attribution was not clear enough',
    'no individual coaching',
    'no pm-specific coaching',
    'no ad-specific coaching',
    'no presenter-specific coaching',
    'no reviewer-specific coaching',
    'no interviewer-specific coaching',
    'no panel-specific coaching',
    'attribution was not clear enough'
  ];

  sections.forEach(function(section) {
    var name    = section.name;
    var content = section.content.trim();

    var hasNoCoaching = NO_COACHING_MARKERS.some(function(marker) {
      return content.toLowerCase().includes(marker.toLowerCase());
    });

    if (hasNoCoaching || !content) {
      Logger.log('  ⏭️  SKIPPED  ' + name + ' — no attributable coaching content this call');
      logToSheet({ status: 'INFO', meetingTopic: meetingTopic, error: 'DM skipped: no coaching content for "' + name + '"' });
      logSpiralFolioEvent({
        eventType:        'slack_dm_skipped',
        source:           'slack',
        severity:         'info',
        message:          'No attributable coaching content for ' + name,
        meetingId:        ctx.meetingId || null,
        meetingTopic:     meetingTopic,
        clientName:       ctx.clientName || null,
        callDate:         callDate || null,
        docUrl:           ctx.docUrl || null,
        slackRecipient:   name,
        payload:          { reason: 'no_attributable_coaching_content' },
      });
      skipped++;
      return;
    }

    var handleEntry = SPIRALYZE_SLACK_HANDLES[name];
    if (!handleEntry) {
      var key = Object.keys(SPIRALYZE_SLACK_HANDLES).find(function(k) {
        return k.toLowerCase().includes(name.toLowerCase()) ||
               name.toLowerCase().includes(k.toLowerCase());
      });
      if (key) handleEntry = SPIRALYZE_SLACK_HANDLES[key];
    }

    if (!handleEntry || !handleEntry.email) {
      Logger.log('  ⚠️  SKIPPED  ' + name + ' — no Slack handle configured');
      logToSheet({ status: 'INFO', meetingTopic: meetingTopic, error: 'DM skipped: no handle for "' + name + '"' });
      logSpiralFolioEvent({
        eventType:      'slack_dm_skipped',
        source:         'slack',
        severity:       'warning',
        message:        'No Slack handle configured for ' + name,
        meetingId:      ctx.meetingId || null,
        meetingTopic:   meetingTopic,
        clientName:     ctx.clientName || null,
        callDate:       callDate || null,
        docUrl:         ctx.docUrl || null,
        slackRecipient: name,
        payload:        { reason: 'no_handle_configured' },
      });
      skipped++;
      return;
    }

    var userId = getSlackUserIdByEmail(handleEntry.email, slackToken);
    if (!userId) {
      Logger.log('  ❌  FAILED   ' + name + ' (' + handleEntry.email + ') — Slack user not found');
      logToSheet({ status: 'WARNING', meetingTopic: meetingTopic, error: 'DM failed: user not found for ' + handleEntry.email });
      logSpiralFolioEvent({
        eventType:           'slack_dm_failed',
        source:              'slack',
        severity:            'warning',
        message:             'Slack user not found for ' + handleEntry.email,
        meetingId:           ctx.meetingId || null,
        meetingTopic:        meetingTopic,
        clientName:          ctx.clientName || null,
        callDate:            callDate || null,
        docUrl:              ctx.docUrl || null,
        slackRecipient:      name,
        slackRecipientEmail: handleEntry.email,
        payload:             { reason: 'user_not_found' },
      });
      failed++;
      return;
    }

    var channelId = openSlackDM(userId, slackToken);
    if (!channelId) {
      Logger.log('  ❌  FAILED   ' + name + ' (' + handleEntry.email + ') — could not open DM channel');
      logToSheet({ status: 'WARNING', meetingTopic: meetingTopic, error: 'DM failed: could not open channel for ' + name });
      logSpiralFolioEvent({
        eventType:           'slack_dm_failed',
        source:              'slack',
        severity:            'warning',
        message:             'Could not open DM channel for ' + name + ' (' + handleEntry.email + ')',
        meetingId:           ctx.meetingId || null,
        meetingTopic:        meetingTopic,
        clientName:          ctx.clientName || null,
        callDate:            callDate || null,
        docUrl:              ctx.docUrl || null,
        slackRecipient:      name,
        slackRecipientEmail: handleEntry.email,
        payload:             { reason: 'channel_open_failed' },
      });
      failed++;
      return;
    }

    Logger.log('  → Sending to: ' + name + ' (' + handleEntry.email + ')');

    // CHANGED: pass formattedDate and name into sendCoachingDM
    var parentTs = sendCoachingDM(
      channelId, name, formattedDate, meetingTopic, content, slackToken
    );

    if (parentTs) {
      if (transcript && transcript.trim()) {
        Utilities.sleep(400);
        sendTranscriptAsThread(channelId, parentTs, transcript, meetingTopic, slackToken);
        Logger.log('  ✅  SENT     ' + name + ' — coaching DM + transcript thread');
      } else {
        Logger.log('  ✅  SENT     ' + name + ' — coaching DM only');
      }
      logToSheet({ status: 'INFO', meetingTopic: meetingTopic, error: '✅ DM sent to ' + name });
      logSpiralFolioEvent({
        eventType:           'slack_dm_sent',
        source:              'slack',
        severity:            'success',
        message:             'Coaching DM sent to ' + name + ' (' + handleEntry.email + ')',
        meetingId:           ctx.meetingId || null,
        meetingTopic:        meetingTopic,
        clientName:          ctx.clientName || null,
        callDate:            callDate || null,
        docUrl:              ctx.docUrl || null,
        slackRecipient:      name,
        slackRecipientEmail: handleEntry.email,
        slackChannelId:      channelId,
        slackTs:             parentTs,
        slackMessage:        content,
        payload:             { transcriptThreaded: !!(transcript && transcript.trim()) },
      });
      sent++;
    } else {
      Logger.log('  ❌  FAILED   ' + name + ' (' + handleEntry.email + ') — postMessage error');
      logToSheet({ status: 'WARNING', meetingTopic: meetingTopic, error: 'DM failed for ' + name });
      logSpiralFolioEvent({
        eventType:           'slack_dm_failed',
        source:              'slack',
        severity:            'error',
        message:             'chat.postMessage failed for ' + name + ' (' + handleEntry.email + ')',
        meetingId:           ctx.meetingId || null,
        meetingTopic:        meetingTopic,
        clientName:          ctx.clientName || null,
        callDate:            callDate || null,
        docUrl:              ctx.docUrl || null,
        slackRecipient:      name,
        slackRecipientEmail: handleEntry.email,
        slackChannelId:      channelId,
        payload:             { reason: 'postMessage_failed' },
      });
      failed++;
    }

    Utilities.sleep(600);
  });

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📊 DM SUMMARY — Sent: ' + sent + '  Skipped: ' + skipped + '  Failed: ' + failed);
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}



// ═══════════════════════════════════════════════════════════════
//  TEST FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Run from Apps Script toolbar to test the full DM + transcript thread flow.
 * Sends a sample coaching DM + transcript to siddarth@spiralyze.com.
 */
function testSlackDM() {
  var slackToken = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  if (!slackToken) { Logger.log('❌ SLACK_BOT_TOKEN not set'); return; }

  var testEmail = 'siddarth@spiralyze.com';
  var userId    = getSlackUserIdByEmail(testEmail, slackToken);
  if (!userId)  { Logger.log('❌ Could not find Slack user for ' + testEmail); return; }

  var channelId = openSlackDM(userId, slackToken);
  if (!channelId) { Logger.log('❌ Could not open DM channel'); return; }

  var testCoaching =
    '• You structured the test review clearly at [00:23:35] — the data was accessible ' +
    'and the client stayed engaged. One thing to consider next time: explicitly confirm ' +
    'the client\'s decision on each test before moving on.\n\n' +
    '• You flagged the sandbox access need at [00:41:37] and kept the conversation moving. ' +
    'To close the loop even more cleanly, state the owner and day on the call: ' +
    '"I\'ll send the dev names by Friday."';

  var testTranscript =
    '[00:00:05] Josh Dreckmeyr: Hi everyone, thanks for joining today.\n' +
    '[00:00:12] Lauren Lewis: Thanks, happy to be here.\n' +
    '[00:00:18] Josh Dreckmeyr: Let\'s jump into this week\'s test results.\n' +
    '[00:00:45] Lauren Lewis: Sounds good — we\'ve been looking forward to this.\n' +
    '[00:01:02] Josh Dreckmeyr: First up — the hero tile test. Results are strong.';

  var parentTs = sendCoachingDM(
    channelId,
    'Siddarth',                              // recipientName
    new Date().toISOString(),                // callDate (use today for test)
    'Test Call — Spiralyze Coaching Bot',    // meetingTopic
    testCoaching,                            // bodyText
    slackToken
  );

  if (parentTs) {
    Logger.log('✅ Coaching DM sent — ts: ' + parentTs);
    Utilities.sleep(400);
    sendTranscriptAsThread(channelId, parentTs, testTranscript, 'Test Call', slackToken);
    Logger.log('✅ Transcript thread sent');
  } else {
    Logger.log('❌ DM failed — check logs above');
  }
}

/**
 * ONE-OFF: Send Sanan's individual feedback from the Dialpad coaching doc.
 * Run once from the Apps Script toolbar.
 * Does NOT re-send to Daria.
 */
function sendSananDialpadFeedback() {
  var slackToken = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  if (!slackToken) { Logger.log('❌ No SLACK_BOT_TOKEN'); return; }

  var DOC_URL  = 'https://docs.google.com/open?id=1iHUFwDYvzX9js39vIaVQVeEmO89KLN_bqsjbE2tTRk8';
  var DOC_ID   = '1iHUFwDYvzX9js39vIaVQVeEmO89KLN_bqsjbE2tTRk8';
  var TOPIC    = 'Dialpad <> Spiralyze weekly meeting';
  var SANAN_ID = 'U08DVMY7Q92';

  // Read full doc text — markdown is stripped by Google Docs,
  // but extractIndividualFeedbackSections now handles plain text headings too
  var docText;
  try {
    docText = DocumentApp.openById(DOC_ID).getBody().getText();
  } catch (e) {
    Logger.log('❌ Could not open coaching doc: ' + e);
    return;
  }

  // Debug: log a snippet so you can see what the heading looks like in plain text
  var sampleLines = docText.split('\n').filter(function(l) {
    return l.toLowerCase().includes('individual feedback');
  });
  Logger.log('INDIVIDUAL FEEDBACK lines found in doc:');
  sampleLines.forEach(function(l) { Logger.log('  |' + l + '|'); });

  var sections = extractIndividualFeedbackSections(docText);
  Logger.log('Sections extracted: ' + sections.map(function(s) { return s.name; }).join(', '));

  var sananSection = sections.find(function(s) {
    return s.name.toLowerCase().includes('sanan');
  });

  if (!sananSection || !sananSection.content.trim()) {
    Logger.log('❌ Could not find Sanan\'s individual feedback section.');
    return;
  }

  Logger.log('✅ Found Sanan\'s section (' + sananSection.content.length + ' chars)');

  // Get transcript from doc
  var transcriptSection = extractNamedSectionFromDoc(DOC_ID, 'FULL CALL TRANSCRIPT');

  // Open DM
  var channelId = openSlackDM(SANAN_ID, slackToken);
  if (!channelId) { Logger.log('❌ Could not open DM channel'); return; }

  // Send coaching DM
  var header   = 'Coaching feedback for: ' + TOPIC;
  var parentTs = sendCoachingDM(channelId, header, sananSection.content, DOC_URL, slackToken);

  if (!parentTs) { Logger.log('❌ Failed to send DM'); return; }

  Logger.log('✅ Coaching DM sent to Sanan');

  // Thread transcript
  if (transcriptSection && transcriptSection.trim()) {
    Utilities.sleep(400);
    sendTranscriptAsThread(channelId, parentTs, transcriptSection, TOPIC, slackToken);
    Logger.log('✅ Transcript threaded');
  }

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('Done. Sanan received coaching DM + transcript. Daria not contacted.');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ═══════════════════════════════════════════════════════════════
//  convertToNumberedBold
//  NEW HELPER
//  Converts bullet lines (-, •, *) to numbered lines.
//  Bolds the positive observation (before the transition phrase)
//  and the improvement suggestion (after it).
// ═══════════════════════════════════════════════════════════════
function convertToNumberedBold(text) {
  var lines   = text.split('\n');
  var counter = 1;
  var result  = [];

  var TRANSITIONS = [
    'to take it even further,',
    'one thing to consider next time:',
    'where you could push it further:',
    'a small addition that would sharpen this:',
    'next time, try',
    'to close the loop even more cleanly,',
    'the one thing that would make this land harder:',
    'building on that, consider',
    'to make the impact stick,',
    'what would elevate this further:',
    'to make it even stronger,',
  ];

  lines.forEach(function(line) {
    var trimmed = line.trim();

    if (/^[-•*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      var content      = trimmed.replace(/^[-•*\d.]+\s*/, '');
      var lowerContent = content.toLowerCase();
      var splitIdx     = -1;
      var splitLen     = 0;

      TRANSITIONS.forEach(function(phrase) {
        var idx = lowerContent.indexOf(phrase);
        if (idx !== -1 && (splitIdx === -1 || idx < splitIdx)) {
          splitIdx = idx;
          splitLen = phrase.length;
        }
      });

      // CHANGED: no * wrappers — plain numbered text only
      var formatted;
      if (splitIdx !== -1) {
        var positive    = content.substring(0, splitIdx).trim();
        var transition  = content.substring(splitIdx, splitIdx + splitLen);
        var improvement = content.substring(splitIdx + splitLen).trim();
        formatted = counter + '. ' + positive + ' ' + transition + ' ' + improvement;
      } else {
        formatted = counter + '. ' + content;
      }

      result.push(formatted);
      counter++;
    } else {
      result.push(line);
    }
  });

  return result.join('\n');
}