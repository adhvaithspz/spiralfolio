// ═══════════════════════════════════════════════════════════════
//  RunCall.gs — UNIVERSAL CALL RUNNER
//  Fill in meetingId below, then run: runCallByMeetingId()
// ═══════════════════════════════════════════════════════════════

var RUN_CONFIG = {

  // ── REQUIRED ────────────────────────────────────────────────
  // Numeric Zoom meeting ID  OR  a fragment of the topic name (case-insensitive)
  meetingId: '81072862648',

  // ── OPTIONAL OVERRIDES ───────────────────────────────────────
  clientNameOverride: null,
  pmNameOverride:     null,
  adNameOverride:     null,

  ignorePreviousContext: false,
  forceExternal:         false,
  callTypeOverride:      null,
  skipDuplicateCheck: true,
};


// ───────────────────────────────────────────────────────────────
//  CALL TYPE DETECTION
// ───────────────────────────────────────────────────────────────
function detectCallType(topic) {
  if (!topic) {
    Logger.log('  🔍 detectCallType: no topic — defaulting to client_weekly');
    return 'client_weekly';
  }

  var t        = topic.toLowerCase();
  var callType = 'client_weekly'; // default

  if (t.includes('design review') || t.includes('flashpoint') ||
      t.includes('figma review')  || t.includes('ux review')  ||
      t.includes('design feedback')) {
    callType = 'design_review';
  } else if (t.includes('sales') || t.includes('demo call') || t.includes('pitch') ||
             t.includes('prospect') || t.includes('discovery call') ||
             t.includes('deck review')) {
    callType = 'sales_call';
  } else if (t.includes('interview') || t.includes('hiring') ||
             t.includes('new hire')  || t.includes('candidate')) {
    callType = 'interview';
  } else if (t.includes('internal') || t.includes('team sync') ||
             t.includes('standup')  || t.includes('retro') ||
             t.includes('planning') || t.includes('all hands')) {
    callType = 'internal';
  }

  Logger.log('  🔍 detectCallType: "' + topic + '" → ' + callType);
  return callType;
}


// ───────────────────────────────────────────────────────────────
//  CLIENT NAME DERIVATION FROM TOPIC
// ───────────────────────────────────────────────────────────────
function deriveClientName(topic) {
  if (!topic) return 'Unknown';
  var match = topic.match(/^([^|<>\-–—]+)/);
  var raw = match ? match[1] : topic;
  return raw.replace(/spiralyze/gi, '').replace(/[<>]/g, '').trim();
}


// ───────────────────────────────────────────────────────────────
//  TEAM MEMBER RESOLVERS
// ───────────────────────────────────────────────────────────────
function resolvePMName(hostEmail) {
  var map = {
    'josh@spiralyze.com':  'Josh',
    'joao@spiralyze.com':  'Joao',
    // add more here
  };
  return map[(hostEmail || '').toLowerCase()] || null;
}

function resolveADName(hostEmail) {
  var map = {
    'lazar@spiralyze.com': 'Lazar',
    // add more here
  };
  return map[(hostEmail || '').toLowerCase()] || null;
}


// ───────────────────────────────────────────────────────────────
//  RETRY WRAPPER
//  Retries processRecordingWithParticipants on bandwidth quota errors.
//  Waits 35 seconds before retrying (quota resets in ~30s).
// ───────────────────────────────────────────────────────────────
function processWithRetry(id, uuid, topic, hostEmail, options, maxRetries) {
  maxRetries = maxRetries || 2;
  var lastError;

  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      processRecordingWithParticipants(id, uuid, topic, hostEmail, options);
      return;
    } catch (e) {
      lastError = e;
      var msg = e.toString();
      if (msg.indexOf('Bandwidth quota exceeded') !== -1 && attempt < maxRetries) {
        Logger.log('⏳ Bandwidth quota hit on attempt ' + attempt +
                   ' — waiting 40s before retry ' + (attempt + 1) + '...');
        logToSheet({
          status:       'INFO',
          meetingTopic: topic,
          error:        'Bandwidth quota — retrying in 40s (attempt ' + attempt + ' of ' + maxRetries + ')'
        });
        Utilities.sleep(40000);
      } else {
        throw e;
      }
    }
  }
  throw lastError;
}


// ───────────────────────────────────────────────────────────────
//  MAIN ENTRY POINT
// ───────────────────────────────────────────────────────────────
function runCallByMeetingId() {

  var cfg = RUN_CONFIG;

  if (!cfg.meetingId || !String(cfg.meetingId).trim()) {
    Logger.log('❌ No meetingId set in RUN_CONFIG. Fill it in and re-run.');
    return;
  }

  var query = String(cfg.meetingId).toLowerCase().trim();

  logToSheet({
    status:       'STARTED',
    meetingTopic: 'RunCall: ' + cfg.meetingId,
    error:        'Looking up recording...'
  });

  try {
    var token      = getZoomAccessToken();
    var recordings = fetchAllPMandADRecordings(token);

    var selected = recordings.find(function(r) {
      return String(r.id) === query ||
             (r.topic || '').toLowerCase().includes(query);
    });

    if (!selected) {
      throw new Error('No recording found matching: "' + cfg.meetingId + '"');
    }

    if (!recordingHasTranscriptFile(selected)) {
      throw new Error(
        'Recording found ("' + selected.topic + '") but transcript is not ready yet. ' +
        'Wait a few minutes and try again.'
      );
    }

    var callType   = cfg.callTypeOverride || detectCallType(selected.topic);
    var clientName = cfg.clientNameOverride || deriveClientName(selected.topic);
    var pmName     = cfg.pmNameOverride     || resolvePMName(selected.host_email);
    var adName     = cfg.adNameOverride     || resolveADName(selected.host_email);

    var isNonClientCall = (callType === 'design_review' ||
                           callType === 'sales_call'    ||
                           callType === 'interview'     ||
                           callType === 'internal');

    var forceExternal = cfg.forceExternal || isNonClientCall;

    Logger.log('✅ Found: "' + selected.topic + '"');
    Logger.log('   Call type: ' + callType);
    Logger.log('   Client/Label: ' + clientName);
    Logger.log('   PM: ' + (pmName || 'not resolved') + ' | AD: ' + (adName || 'not resolved'));
    Logger.log('   forceExternal: ' + forceExternal);

    logToSheet({
      status:       'INFO',
      meetingTopic: selected.topic,
      error:        'Type: ' + callType + ' | Client: ' + clientName + ' | forceExternal: ' + forceExternal
    });

    // CHANGED: recordingData passed — prevents a redundant getRecordingDetails
    // API call inside processRecordingWithParticipants that can fail on quota
    processWithRetry(
      selected.id,
      selected.uuid || selected.id,
      selected.topic,
      selected.host_email,
      {
        callType:              callType,
        forceExternal:         forceExternal,
        clientNameOverride:    clientName,
        pmNameOverride:        pmName,
        adNameOverride:        adName,
        ignorePreviousContext: cfg.ignorePreviousContext,
        recordingData:         selected,   // ← skip getRecordingDetails
      },
      2
    );

    logToSheet({
      status:       'SUCCESS',
      meetingTopic: selected.topic,
      error:        'Coaching doc created successfully.'
    });

  } catch (e) {
    Logger.log('❌ runCallByMeetingId failed: ' + e);
    logToSheet({ status: 'ERROR', meetingTopic: cfg.meetingId, error: e.toString() });
  }
}