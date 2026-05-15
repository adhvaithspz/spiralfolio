// ═══════════════════════════════════════════════════════════════
//  SpiralFolio.gs — Apps Script → SpiralFolio integration
//
//  After each call is processed by the existing pipeline this module
//  posts the transcript to SpiralFolio so the client brain is updated
//  automatically (contacts, concerns, deliverables, decisions, wins).
//
//  SETUP (one-time, in Script Properties):
//    SPIRALFOLIO_BASE_URL  →  https://your-deployment.vercel.app
//    SPIRALFOLIO_API_KEY   →  any secret string you also put in
//                             SpiralFolio's SPIRALFOLIO_API_KEY env var
//
//  If SPIRALFOLIO_BASE_URL is not set, all calls no-op silently.
// ═══════════════════════════════════════════════════════════════


/**
 * Resolve a client name to a SpiralFolio client_id.
 * Returns null if the client is not found or SpiralFolio is not configured.
 *
 * @param {string} clientName  e.g. "TechSmith" or "32Auctions"
 * @returns {string|null}
 */
function resolveSpiraFolioClientId(clientName) {
  var props   = PropertiesService.getScriptProperties();
  var baseUrl = (props.getProperty('SPIRALFOLIO_BASE_URL') || '').trim().replace(/\/$/, '');
  if (!baseUrl) return null;

  var apiKey  = props.getProperty('SPIRALFOLIO_API_KEY') || '';
  var url     = baseUrl + '/api/clients/lookup?name=' + encodeURIComponent(clientName);

  try {
    var response = UrlFetchApp.fetch(url, {
      method:             'get',
      headers:            apiKey ? { Authorization: 'Bearer ' + apiKey } : {},
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      Logger.log('[SpiralFolio] Lookup failed for "' + clientName + '": HTTP ' +
                 response.getResponseCode() + ' — ' + response.getContentText().slice(0, 200));
      return null;
    }

    var data = JSON.parse(response.getContentText());
    Logger.log('[SpiralFolio] Resolved "' + clientName + '" → client_id: ' + data.client.id);
    return data.client.id;

  } catch (err) {
    Logger.log('[SpiralFolio] resolveClientId error: ' + err);
    return null;
  }
}


/**
 * Post a processed transcript to SpiralFolio.
 * Call this at the end of processRecordingWithParticipants().
 *
 * The call is fire-and-forget from the Apps Script perspective — errors are
 * logged but never thrown so they can't break the existing pipeline.
 *
 * @param {Object} opts
 * @param {string} opts.clientName    e.g. "TechSmith"
 * @param {string} opts.transcript    full VTT/plain transcript text
 * @param {string} opts.callDate      ISO date string "2026-05-12"
 * @param {string} opts.callType      "kickoff" | "weekly" | "ad-hoc" | "review"
 * @param {string} [opts.pmName]      optional, used only for logging
 * @param {string} [opts.adName]      optional, used only for logging
 * @param {string} [opts.meetingId]   Zoom meeting id — forwarded so SpiralFolio logs correlate with Apps Script
 * @param {string} [opts.meetingTopic]
 */
function postToSpiralFolio(opts) {
  var props   = PropertiesService.getScriptProperties();
  var baseUrl = (props.getProperty('SPIRALFOLIO_BASE_URL') || '').trim().replace(/\/$/, '');

  if (!baseUrl) {
    Logger.log('[SpiralFolio] SPIRALFOLIO_BASE_URL not set — skipping brain update');
    return;
  }

  var clientName = opts.clientName || 'Unknown';
  var clientId   = resolveSpiraFolioClientId(clientName);

  if (!clientId) {
    Logger.log('[SpiralFolio] Could not resolve client_id for "' + clientName + '" — skipping');
    return;
  }

  var apiKey   = props.getProperty('SPIRALFOLIO_API_KEY') || '';
  var callDate = opts.callDate
    ? String(opts.callDate).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Map Apps Script call types to SpiralFolio call types
  var typeMap = {
    'client_weekly':  'weekly',
    'client_kickoff': 'kickoff',
    'design_review':  'review',
    'sales_call':     'ad-hoc',
    'interview':      'ad-hoc',
    'internal':       'ad-hoc',
  };
  var callType = typeMap[opts.callType] || opts.callType || 'weekly';

  var payloadObj = {
    client_id:       clientId,
    transcript_text: opts.transcript || '',
    call_date:       callDate,
    call_type:       callType,
  };
  if (opts.meetingId) {
    payloadObj.meeting_id = String(opts.meetingId);
  }
  if (opts.meetingTopic) {
    payloadObj.meeting_topic = String(opts.meetingTopic);
  }
  var payload = JSON.stringify(payloadObj);

  try {
    var response = UrlFetchApp.fetch(baseUrl + '/api/calls/process', {
      method:             'post',
      contentType:        'application/json',
      headers:            apiKey ? { Authorization: 'Bearer ' + apiKey } : {},
      payload:            payload,
      muteHttpExceptions: true,
    });

    var code = response.getResponseCode();
    if (code === 200) {
      var result = JSON.parse(response.getContentText());
      Logger.log('[SpiralFolio] ✅ Brain updated for "' + clientName + '"' +
                 ' | call_id: ' + result.call_id +
                 ' | ' + JSON.stringify(result.changes_summary));
    } else {
      Logger.log('[SpiralFolio] ⚠️ process returned HTTP ' + code +
                 ' — ' + response.getContentText().slice(0, 300));
    }

  } catch (err) {
    Logger.log('[SpiralFolio] postToSpiralFolio error: ' + err);
  }
}


/**
 * Fire-and-forget ingestion of a pipeline event into the SpiralFolio admin
 * event log (the Operations Console at /admin in the Next.js app).
 *
 * If SPIRALFOLIO_BASE_URL is not configured, this no-ops silently. Errors
 * are caught and logged but never thrown — the surrounding pipeline (Zoom
 * processing, Slack DMs, etc.) must never break because logging failed.
 *
 * @param {Object} opts
 * @param {string} opts.eventType                e.g. 'slack_dm_sent'
 * @param {string} [opts.severity]               'info' | 'success' | 'warning' | 'error'
 * @param {string} [opts.source]                 'appscript' (default) | 'cloudflare' | 'slack'
 * @param {string} [opts.message]                Free-form summary line
 * @param {string} [opts.clientName]             Resolved client name
 * @param {string} [opts.clientId]               Pre-resolved SpiralFolio client_id
 * @param {string} [opts.meetingId]              Zoom meeting ID
 * @param {string} [opts.meetingTopic]
 * @param {string} [opts.callDate]               ISO date string
 * @param {string} [opts.docUrl]                 Coaching Google Doc URL
 * @param {string} [opts.slackRecipient]         Display name
 * @param {string} [opts.slackRecipientEmail]
 * @param {string} [opts.slackMessage]           Full body of the DM (truncated server-side if huge)
 * @param {string} [opts.slackChannelId]
 * @param {string} [opts.slackTs]
 * @param {*}      [opts.payload]                Anything extra; serialised as JSON
 */
function logSpiralFolioEvent(opts) {
  var props   = PropertiesService.getScriptProperties();
  var baseUrl = (props.getProperty('SPIRALFOLIO_BASE_URL') || '').trim().replace(/\/$/, '');
  if (!baseUrl) return;
  if (!opts || !opts.eventType) return;

  var apiKey = props.getProperty('SPIRALFOLIO_API_KEY') || '';

  var body = {
    event_type:            opts.eventType,
    source:                opts.source   || 'appscript',
    severity:              opts.severity || 'info',
    message:               opts.message  || null,
    client_name:           opts.clientName || null,
    client_id:             opts.clientId   || null,
    meeting_id:            opts.meetingId   ? String(opts.meetingId) : null,
    meeting_topic:         opts.meetingTopic || null,
    call_date:             opts.callDate     || null,
    doc_url:               opts.docUrl       || null,
    slack_recipient:       opts.slackRecipient      || null,
    slack_recipient_email: opts.slackRecipientEmail || null,
    slack_message:         opts.slackMessage        || null,
    slack_channel_id:      opts.slackChannelId      || null,
    slack_ts:              opts.slackTs             || null,
    payload:               opts.payload || null,
    occurred_at:           new Date().toISOString(),
  };

  try {
    UrlFetchApp.fetch(baseUrl + '/api/events/log', {
      method:             'post',
      contentType:        'application/json',
      headers:            apiKey ? { Authorization: 'Bearer ' + apiKey } : {},
      payload:            JSON.stringify(body),
      muteHttpExceptions: true,
    });
  } catch (err) {
    Logger.log('[SpiralFolio] logEvent error (' + opts.eventType + '): ' + err);
  }
}
