// ═══════════════════════════════════════════════════════════
//  TESTING FUNCTIONS - WITH SPEED OPTIMIZATION TESTS
// ═══════════════════════════════════════════════════════════

/**
 * Test 0: Initialize spreadsheet
 */
function testInitializeSpreadsheet() {
  Logger.log('🔧 Initializing spreadsheet for logging...\n');
  
  const url = initializeSheets();
  
  Logger.log('\n✅ Done! Open the spreadsheet:');
  Logger.log(url);
  Logger.log('\n💡 Bookmark this URL - all logs will go here.');
}

/**
 * Test 1: List all PM/AD users
 */
function testListPMsAndADs() {
  logToSheet({
    status: 'TEST',
    meetingTopic: 'Test 1: List PMs and ADs',
    error: 'Starting...'
  });
  
  try {
    const token = getZoomAccessToken();
    const pmsAndADs = getPMsAndADs(token);
    
    pmsAndADs.forEach(user => {
      logToSheet({
        status: 'INFO',
        hostEmail: user.email,
        hostName: `${user.first_name} ${user.last_name}`,
        role: getUserRole(user.email),
        meetingTopic: 'PM/AD Found',
        error: `Type: ${user.type === 2 ? 'Licensed' : 'Basic'}`
      });
    });
    
    logToSheet({
      status: 'TEST COMPLETE',
      meetingTopic: 'Test 1: List PMs and ADs',
      error: `Total: ${pmsAndADs.length} users found`
    });
    
    const url = getSpreadsheetUrl();
    Logger.log(`✅ Test complete - check spreadsheet:`);
    Logger.log(url);
    
  } catch (error) {
    logToSheet({
      status: 'TEST FAILED',
      meetingTopic: 'Test 1',
      error: error.toString()
    });
    Logger.log('❌ Test failed: ' + error);
  }
}

/**
 * Test 2: Fetch all recordings
 */
function testFetchAllRecordings() {
  logToSheet({
    status: 'TEST',
    meetingTopic: 'Test 2: Fetch All Recordings',
    error: 'Starting...'
  });
  
  try {
    const token = getZoomAccessToken();
    const recordings = fetchAllPMandADRecordings(token);
    
    recordings.forEach(rec => {
      const hasTranscript = rec.recording_files.some(f => f.file_type === 'TRANSCRIPT');
      
      logToSheet({
        status: 'INFO',
        meetingTopic: rec.topic,
        hostEmail: rec.host_email,
        hostName: rec.host_name,
        role: rec.host_role,
        transcriptLength: 0,
        feedbackGenerated: false,
        error: hasTranscript ? 'Has transcript' : 'No transcript'
      });
    });
    
    logToSheet({
      status: 'TEST COMPLETE',
      meetingTopic: 'Test 2: Fetch All Recordings',
      error: `Found ${recordings.length} total recordings`
    });
    
    const url = getSpreadsheetUrl();
    Logger.log(`✅ Test complete - check spreadsheet:`);
    Logger.log(url);
    
  } catch (error) {
    logToSheet({
      status: 'TEST FAILED',
      meetingTopic: 'Test 2',
      error: error.toString()
    });
    Logger.log('❌ Test failed: ' + error);
  }
}

/**
 * Test 3: Process most recent recording
 */
function testProcessMostRecentRecording() {
  logToSheet({
    status: 'TEST',
    meetingTopic: 'Test 3: Process Recent Recording',
    error: 'Starting...'
  });
  
  try {
    const token = getZoomAccessToken();
    const recordings = fetchAllPMandADRecordings(token);
    
    if (recordings.length === 0) {
      logToSheet({
        status: 'TEST FAILED',
        meetingTopic: 'Test 3',
        error: 'No recordings found to process'
      });
      Logger.log('❌ No recordings found');
      return;
    }
    
    const testRecording = recordings[0];
    
    logToSheet({
      status: 'INFO',
      meetingTopic: 'Test 3',
      error: `Processing: ${testRecording.topic}`
    });
    
    processClientCall(testRecording.id, testRecording.topic);
    
    logToSheet({
      status: 'TEST COMPLETE',
      meetingTopic: 'Test 3: Process Recent Recording',
      error: 'Successfully processed one recording'
    });
    
    const url = getSpreadsheetUrl();
    Logger.log(`✅ Test complete - check spreadsheet:`);
    Logger.log(url);
    
  } catch (error) {
    logToSheet({
      status: 'TEST FAILED',
      meetingTopic: 'Test 3',
      error: error.toString()
    });
    
    Logger.log('❌ Test failed: ' + error);
  }
}

/**
 * Clear output sheet
 */
function clearOutputSheet() {
  try {
    const sheet = getOutputSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
      Logger.log(`✅ Cleared ${lastRow - 1} rows from output sheet`);
      
      logToSheet({
        status: 'INFO',
        meetingTopic: 'Sheet Cleared',
        error: `Removed ${lastRow - 1} rows`
      });
    } else {
      Logger.log('ℹ️  Output sheet is already empty');
    }
  } catch (error) {
    Logger.log('Error clearing sheet: ' + error);
  }
}

/**
 * Get the spreadsheet URL
 */
function getSheetUrl() {
  const url = getSpreadsheetUrl();
  Logger.log('📊 Spreadsheet URL:');
  Logger.log(url);
  return url;
}

/**
 * Sample transcript for testing
 */
function getSampleTranscript() {
  return `Meeting: Client Kickoff - Acme Corp
Date: January 20, 2024
Participants: Sarah (PM), Mike (AD), John (Client - Acme Corp)

[00:00:05] Sarah: Hi John, thanks so much for joining us today. Really excited to kick off this project with Acme Corp.

[00:00:12] John: Thanks for having me. I'm looking forward to getting started.

[00:00:16] Sarah: Great! So to start, can you tell me a bit about the main challenges you're facing with your current system?

[00:00:25] John: Well, the biggest issue is that our current platform is just too slow. Our team spends hours every day waiting for reports to load. It's really frustrating.

[00:00:38] Sarah: I can imagine how frustrating that must be. How many users are affected by this?

[00:00:44] John: About 50 people across three departments.

[00:00:48] Mike: And John, what would success look like for you in this project?

[00:00:53] John: Honestly, if we could cut those wait times down to under a minute, that would be a game changer. Also, we need better integration with our CRM.

[00:01:04] Sarah: Definitely achievable. Speaking of timeline, when are you hoping to have this live?

[00:01:10] John: We're hoping for end of Q2, but I'll be honest, budget approval is still pending. My VP is concerned about the cost.

[00:01:20] Sarah: Understood. We can definitely work with you on phasing the implementation to spread costs. Have you had a chance to review the pricing proposal we sent?

[00:01:30] John: I did, but I haven't gone through it in detail yet. There's just been a lot on my plate.

[00:01:36] Mike: No worries at all. Why don't we schedule a follow-up next week specifically to go through pricing and answer any questions?

[00:01:44] John: That would be great.

[00:01:46] Sarah: Perfect. I'll send you a calendar invite right after this call. Anything else you want to cover today?

[00:01:52] John: I think we've covered the main points. Looking forward to next steps.

[00:01:56] Sarah: Excellent. Thanks so much for your time, John. We'll talk next week.

[00:02:00] John: Sounds good. Bye everyone.`;
}

/**
 * Test client name extraction patterns
 */
function testClientNameExtraction() {
  const testCases = [
    'Client: Acme Corp - Kickoff Call',
    'Acme Corp - Project Planning',
    '[Acme Corp] Weekly Sync',
    'Fleetio <> Spiralyze | Weekly Check In',
    'TechCo <> Spiralyze - Discovery',
    'Meeting with GlobalCorp | Demo',
    'Random Meeting Title'
  ];
  
  Logger.log('🧪 Testing client name extraction:\n');
  
  testCases.forEach(title => {
    const extracted = extractClientName(title);
    Logger.log(`"${title}"`);
    Logger.log(`  → ${extracted || 'NOT FOUND'}\n`);
  });
}

// ═══════════════════════════════════════════════════════════
//  TESTING FUNCTIONS
// ═══════════════════════════════════════════════════════════

function testActiveAIProvider() {
  Logger.log('🧪 Testing active AI provider...');
  Logger.log('Active provider: ' + getActiveAIProvider());
  Logger.log('OpenAI model: ' + CONFIG.OPENAI_MODEL);
  Logger.log('Claude model: ' + CONFIG.CLAUDE_MODEL);
  Logger.log('Slack enabled: ' + CONFIG.ENABLE_SLACK_POSTING);
}

function testReviewerFeedbackContext() {
  Logger.log('🧪 Testing reviewer feedback context...');
  const context = getReviewerFeedbackContext();

  if (!context) {
    Logger.log('No reviewer feedback docs configured.');
    return;
  }

  Logger.log(context.substring(0, 2000));
}

function testOpenAIConnection() {
  if (getActiveAIProvider() !== 'openai') {
    Logger.log('⚠️ CONFIG.AI_PROVIDER is not set to openai');
    return;
  }

  const feedback = analyzeCallWithContext(
    getSampleTranscript(),
    'Acme Corp',
    'Sarah',
    'Mike',
    null,
    null,
    'client_weekly'
  );

  Logger.log('✅ OpenAI response received:');
  Logger.log(feedback.substring(0, 4000));
}

function getSortedRecentRecordings() {
  const token = getZoomAccessToken();
  const recordings = fetchAllPMandADRecordings(token) || [];

  return recordings.sort((a, b) => {
    const aTime = new Date(a.start_time || 0).getTime();
    const bTime = new Date(b.start_time || 0).getTime();
    return bTime - aTime;
  });
}

function isFleetioAlreadyAnalysedExample(recording) {
  const topic = (recording.topic || '').trim();
  const dateOnly = (recording.start_time || '').slice(0, 10);

  return (
    topic === 'Fleetio <> Spiralyze | Weekly Check In' &&
    dateOnly === '2026-04-15'
  );
}

function isCleerlyAlreadyAnalysedExample(recording) {
  const topic = (recording.topic || '').trim();
  const dateOnly = (recording.start_time || '').slice(0, 10);

  return (
    topic === 'SPZ <> Cleerly | Weekly CRO' &&
    dateOnly === '2026-04-20'
  );
}

function isRecordingAlreadyProcessed(recording) {
  try {
    const sheet = getTranscriptSheet();
    const data  = sheet.getDataRange().getValues();

    if (data.length < 2) return false;

    const recordingId = String(recording.id   || '').trim();
    const topic       = String(recording.topic || '').trim();
    const dateOnly    = recording.start_time
      ? String(recording.start_time).slice(0, 10)
      : null;

    for (let i = 1; i < data.length; i++) {
      const rowDateRaw   = data[i][0];
      const rowClient    = data[i][1];
      // Strip leading apostrophe if present (text-forced cells)
      const rowMeetingId = String(data[i][2] || '').trim().replace(/^'+/, '');

      // ── Parse stored date correctly ────────────────────────────
      // getValues() returns Date objects for date cells, but legacy rows
      // may have Excel serial numbers (numeric) or strings
      let normalizedRowDate = null;

      if (rowDateRaw instanceof Date && !isNaN(rowDateRaw.getTime())) {
        // Standard case — Google Sheets returned a Date object
        normalizedRowDate = Utilities.formatDate(
          rowDateRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd'
        );
      } else if (typeof rowDateRaw === 'number' && rowDateRaw > 40000) {
        // Excel serial date — convert to JS Date
        // Excel epoch is Dec 30, 1899
        const excelEpoch = new Date(1899, 11, 30);
        const jsDate     = new Date(excelEpoch.getTime() + rowDateRaw * 86400000);
        normalizedRowDate = Utilities.formatDate(
          jsDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'
        );
      } else if (typeof rowDateRaw === 'string' && rowDateRaw.trim()) {
        try {
          const parsed = new Date(rowDateRaw);
          if (!isNaN(parsed.getTime())) {
            normalizedRowDate = Utilities.formatDate(
              parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd'
            );
          }
        } catch (e) { /* ignore unparseable dates */ }
      }

      // ── Match: same meeting ID + same date ────────────────────
      if (rowMeetingId === recordingId && normalizedRowDate && dateOnly) {
        if (normalizedRowDate === dateOnly) {
          Logger.log('⏭️ Duplicate prevented — same ID + date: ' + recordingId + ' on ' + dateOnly);
          return true;
        }
        // Same ID, different date = recurring weekly meeting = allow
        continue;
      }

      // ── Secondary: same client + same date ────────────────────
      if (normalizedRowDate && rowClient && dateOnly && normalizedRowDate === dateOnly) {
        const extractedClient = extractClientName(topic);
        if (extractedClient &&
            String(rowClient).toLowerCase() === extractedClient.toLowerCase()) {
          Logger.log('⏭️ Duplicate prevented — same client + date: ' + extractedClient + ' on ' + dateOnly);
          return true;
        }
      }
    }

    return false;

  } catch (error) {
    Logger.log('Error checking processed recordings: ' + error);
    return false;
  }
}

/**
 * Skip calls with no transcript file
 */
function recordingHasTranscriptFile(recording) {
  const files = recording && recording.recording_files ? recording.recording_files : [];
  return files.some(file =>
    file.file_type === 'TRANSCRIPT' || file.recording_type === 'audio_transcript'
  );
}

/**
 * DEBUG: Show participant details for recent recordings
 */
function debugParticipantDetection() {
  Logger.log('🔍 DEBUGGING PARTICIPANT DETECTION\n');
  Logger.log('═══════════════════════════════════════════════════\n');

  try {
    const token = getZoomAccessToken();
    const recordings = getSortedRecentRecordings();

    const limit = 15;
    let checked = 0;

    for (let i = 0; i < recordings.length && checked < limit; i++) {
      const recording = recordings[i];
      const meetingUuid = recording.uuid || recording.id;

      Logger.log(`\n${checked + 1}. "${recording.topic}"`);
      Logger.log(`   Date: ${recording.start_time}`);
      Logger.log(`   Host: ${recording.host_email}`);
      Logger.log(`   Has transcript: ${recordingHasTranscriptFile(recording) ? 'YES' : 'NO'}`);

      const participants = getParticipantDetails(recording.id, meetingUuid, token);

      Logger.log(`   Participants found: ${participants.length}`);

      if (participants.length > 0) {
        participants.forEach(p => {
          const match = getSpiralyzeParticipantMatch(p.name);
          const label = match ? `[INTERNAL ${match.role}]` : '[CLIENT/UNKNOWN]';
          Logger.log(`     - ${p.name || 'Unknown'} ${label}`);
        });
      }

      const isExternal = shouldTreatAsExternalClientCall(participants, recording.topic);
      const externalCount = getExternalParticipants(participants).length;

      Logger.log(`   Classification: ${isExternal ? '🌐 EXTERNAL' : '🏢 INTERNAL'}`);
      Logger.log(`   External participants by name: ${externalCount}`);
      Logger.log(`   Extracted client: ${extractClientName(recording.topic) || 'NOT FOUND'}`);
      Logger.log(`   ─────────────────────────────────────────────`);

      checked++;
    }

    Logger.log('\n═══════════════════════════════════════════════════');
    Logger.log('✅ Debug complete');

  } catch (error) {
    Logger.log('❌ Debug failed: ' + error);
  }
}

function listRecentExternalClientCalls(limit) {
  limit = limit || 20;

  logToSheet({
    status: 'TEST',
    meetingTopic: 'List Recent External Client Calls',
    error: `Starting... limit=${limit}`
  });

  try {
    const token = getZoomAccessToken();
    const recordings = getSortedRecentRecordings();

    let found = 0;
    let checked = 0;

    Logger.log('🔍 Searching for external client calls...\n');

    for (let i = 0; i < recordings.length && found < limit; i++) {
      const recording = recordings[i];
      const meetingUuid = recording.uuid || recording.id;

      checked++;

      const participants = getParticipantDetails(recording.id, meetingUuid, token);
      const isExternal = shouldTreatAsExternalClientCall(participants, recording.topic);
      const externalParticipants = getExternalParticipants(participants);
      const internalParticipants = getInternalParticipants(participants);

      if (!isExternal) {
        continue;
      }

      found++;

      const externalNames = externalParticipants.length
        ? externalParticipants.map(p => p.name || 'Unknown').join(', ')
        : 'No external participant names detected';

      const pmName = extractPMNameFromParticipants(internalParticipants, recording.topic);
      const adName = extractADNameFromParticipants(internalParticipants, recording.topic);
      const clientName = extractClientName(recording.topic) || 'Unknown Client';

      Logger.log(`${found}. "${recording.topic}"`);
      Logger.log(`   Date: ${recording.start_time}`);
      Logger.log(`   ID: ${recording.id}`);
      Logger.log(`   Client: ${clientName}`);
      Logger.log(`   PM: ${pmName}`);
      Logger.log(`   AD: ${adName}`);
      Logger.log(`   Has transcript: ${recordingHasTranscriptFile(recording) ? 'YES' : 'NO'}`);
      Logger.log(`   Client-side participants: ${externalNames}`);
      Logger.log(`   Total participants: ${participants.length}\n`);

      logToSheet({
        status: 'INFO',
        meetingTopic: recording.topic,
        hostEmail: recording.host_email,
        hostName: recording.host_name,
        role: recording.host_role,
        error: `External #${found} | ${externalParticipants.length} client-side participants`
      });
    }

    Logger.log(`\n═══════════════════════════════════════════════════`);
    Logger.log(`Checked ${checked} recordings, found ${found} external client calls`);
    Logger.log(`═══════════════════════════════════════════════════`);

    logToSheet({
      status: 'TEST COMPLETE',
      meetingTopic: 'List Recent External Client Calls',
      error: `Checked ${checked}, found ${found} external calls`
    });

  } catch (error) {
    logToSheet({
      status: 'TEST FAILED',
      meetingTopic: 'List Recent External Client Calls',
      error: error.toString()
    });
    Logger.log('❌ Test failed: ' + error);
  }
}

function testProcessNextExternalClientRecording() {
  logToSheet({
    status: 'TEST',
    meetingTopic: 'Test: Process Next External Client Recording',
    error: 'Starting...'
  });

  try {
    const token      = getZoomAccessToken();
    const recordings = fetchAllPMandADRecordings(token);

    if (recordings.length === 0) {
      logToSheet({
        status: 'TEST FAILED',
        meetingTopic: 'Test: Process Next External Client Recording',
        error: 'No recordings found'
      });
      return;
    }

    const candidates = [];
    for (let i = 0; i < recordings.length; i++) {
      const recording = recordings[i];

      if (!recordingHasTranscriptFile(recording)) continue;
      if (isRecordingAlreadyProcessed(recording)) continue;

      const participants = [];
      const isExternal   = shouldTreatAsExternalClientCall(participants, recording.topic);
      if (!isExternal) continue;

      candidates.push(recording);
    }

    if (candidates.length === 0) {
      logToSheet({
        status: 'TEST FAILED',
        meetingTopic: 'Test: Process Next External Client Recording',
        error: 'No unprocessed external client calls found'
      });
      Logger.log('❌ No candidates found');
      return;
    }

    // ── Sort newest first so most recent unprocessed call is attempted first
    candidates.sort(function(a, b) {
      return new Date(b.start_time || 0) - new Date(a.start_time || 0);
    });

    Logger.log(`Found ${candidates.length} candidate(s) — attempting newest first...`);
    Logger.log(`Most recent candidate: "${candidates[0].topic}" | ${candidates[0].start_time}`);

    for (let i = 0; i < candidates.length; i++) {
      const selected = candidates[i];

      logToSheet({
        status: 'INFO',
        meetingTopic: selected.topic,
        hostEmail: selected.host_email,
        error: `Attempt ${i + 1} of ${candidates.length}: ${selected.topic} | ${selected.start_time}`
      });

      Logger.log(`▶ Trying [${i + 1}/${candidates.length}]: ${selected.topic} | ${selected.start_time}`);

      try {
        processWithRetry(
          selected.id,
          selected.uuid || selected.id,
          selected.topic,
          selected.host_email,
          {
            recordingData: selected,
          },
          2
        );

        logToSheet({
          status: 'TEST COMPLETE',
          meetingTopic: selected.topic,
          error: `✅ Successfully processed on attempt ${i + 1}`
        });
        Logger.log(`✅ Done: ${selected.topic}`);
        return;

      } catch (err) {
        const reason = err.toString();
        Logger.log(`⚠️ Skipping [${selected.topic}]: ${reason}`);
        logToSheet({
          status: 'SKIPPED',
          meetingTopic: selected.topic,
          hostEmail: selected.host_email,
          error: `Skipped (attempt ${i + 1}): ${reason}`
        });
      }
    }

    logToSheet({
      status: 'TEST FAILED',
      meetingTopic: 'Test: Process Next External Client Recording',
      error: `All ${candidates.length} candidate(s) failed or were skipped`
    });
    Logger.log(`❌ All ${candidates.length} candidates exhausted`);

  } catch (error) {
    logToSheet({
      status: 'TEST FAILED',
      meetingTopic: 'Test: Process Next External Client Recording',
      error: error.toString()
    });
    Logger.log('❌ Test failed: ' + error);
  }
}

function testCalibrationDocAccess() {
  const raw = PropertiesService.getScriptProperties().getProperty('COACHING_FEEDBACK_DOC_IDS');
  Logger.log('Raw property: ' + raw);

  if (!raw) {
    Logger.log('No COACHING_FEEDBACK_DOC_IDS property found.');
    return;
  }

  const ids = raw.split(',').map(s => s.trim()).filter(Boolean);

  ids.forEach(function(id, index) {
    try {
      Logger.log(`Checking doc ${index + 1}: ${id}`);

      const file = DriveApp.getFileById(id);
      Logger.log('Drive file found: ' + file.getName());
      Logger.log('Mime type: ' + file.getMimeType());

      const doc = DocumentApp.openById(id);
      Logger.log('Google Doc opened successfully: ' + doc.getName());

      const text = doc.getBody().getText();
      Logger.log('First 300 chars: ' + text.substring(0, 300));

    } catch (error) {
      Logger.log(`FAILED for ${id}: ${error}`);
    }
  });
}


function processSpecificRecordingWithoutPreviousContext(meetingId, meetingUuid, meetingTopic, hostEmail) {
  const startTime = new Date();

  logToSheet({
    status: 'STARTED',
    meetingTopic: meetingTopic,
    hostEmail: hostEmail,
    error: `Processing specific first-call meeting ID: ${meetingId}`
  });

  try {
    const token = getZoomAccessToken();

    const recording = getRecordingDetails(meetingId, token);
    if (!recording) {
      throw new Error('Recording not found');
    }

    if (!recordingHasTranscriptFile(recording)) {
      throw new Error('Transcript not available');
    }

    const participants        = getParticipantDetails(meetingId, meetingUuid, token);
    const isExternal          = shouldTreatAsExternalClientCall(participants, meetingTopic);
    const externalParticipants = getExternalParticipants(participants);
    const internalParticipants = getInternalParticipants(participants);

    if (!isExternal) {
      throw new Error('This call is not classified as an external client call');
    }

    const transcript = downloadTranscript(recording, token);
    if (!transcript) {
      throw new Error('Transcript not available');
    }

    const clientName = extractClientName(meetingTopic) || 'Unknown Client';
    const pmName     = extractPMNameFromParticipants(internalParticipants, meetingTopic);
    const adName     = extractADNameFromParticipants(internalParticipants, meetingTopic);

    // Force NO previous context — this is a first-call function
    const previousContext    = null;
    const participantContext = buildParticipantContext(participants, isExternal, externalParticipants);

    // FIXED: was 'analysisTranscript' (undefined) — now correctly 'transcript'
    // FIXED: was 'options.callType' (undefined) — hardcoded 'client_weekly' (this function has no options param)
    const feedback = analyzeCallWithContext(
      transcript,
      clientName,
      pmName,
      adName,
      previousContext,
      participantContext,
      'client_weekly'
    );

    const futureContextSummary = extractFutureContextSummaryFromFeedback(feedback)
      || generateSummary(feedback);

    // FIXED: futureContextSummary now passed as 9th argument
    const docUrl = createBeautifulGoogleDoc(
      meetingTopic,
      clientName,
      pmName,
      adName,
      transcript,
      feedback,
      recording.start_time,
      externalParticipants,
      futureContextSummary
    );

    storeTranscriptWithDocLink(
      clientName,
      meetingId,
      pmName,
      adName,
      transcript,
      futureContextSummary,
      'SLACK_DISABLED',
    participants,
      isExternal,
      docUrl
    );

    const duration = (new Date() - startTime) / 1000;
    logToSheet({
      status:            'SUCCESS',
      meetingTopic:      meetingTopic,
      clientName:        clientName,
      hostEmail:         hostEmail,
      hostName:          pmName || adName || 'Unknown',
      role:              getUserRole(hostEmail),
      transcriptLength:  transcript.length,
      feedbackGenerated: true,
      error:             `✅ Completed in ${duration.toFixed(1)}s | Forced first-call mode`
    });

    Logger.log('📄 Coaching doc created successfully');
    Logger.log(docUrl);

  } catch (error) {
    const duration = (new Date() - startTime) / 1000;
    logToSheet({
      status:       'ERROR',
      meetingTopic: meetingTopic,
      hostEmail:    hostEmail,
      error:        `${error.toString()} (after ${duration.toFixed(1)}s)`
    });
    throw error;
  }
}

function testProcess32AuctionsTranscriptFromGoogleDoc() {
  const docId = '1wqTbTq63-CZJDItp3CZ54ITEtvCK6BtvGBh67Fptvh0';

  const transcriptText = readTranscriptTextFromDrive(docId);

  processManualTranscript({
    meetingTopic: '32Auctions <> Spiralyze - Weekly CRO',
    hostEmail: 'arbab@spiralyze.com',
    meetingDate: '2026-04-29T22:30:00',
    transcriptText: transcriptText,
    ignorePreviousContext: true
  });
}

function testParse32AuctionsTranscriptFromGoogleDoc() {
  const docId = '1wqTbTq63-CZJDItp3CZ54ITEtvCK6BtvGBh67Fptvh0';

  const rawText = readTranscriptTextFromDrive(docId);
  Logger.log('RAW TRANSCRIPT PREVIEW:\n' + rawText.substring(0, 1500));

  const parsed = parseThirdPartyTranscript(rawText);

  if (!parsed || !parsed.trim()) {
    Logger.log('❌ Parser returned empty output');
    return;
  }

  Logger.log('✅ PARSED TRANSCRIPT PREVIEW:\n' + parsed.substring(0, 2500));
}

function testProcessCandelaWeeklyMeeting() {
  logToSheet({
    status: 'TEST',
    meetingTopic: 'Test: Candela Weekly Meeting',
    error: 'Starting specific Candela processing...'
  });

  try {
    const targetMeetingId = '81630901540';
    const token = getZoomAccessToken();
    const recordings = fetchAllPMandADRecordings(token);

    const selected = recordings.find(function(r) {
      const topic = (r.topic || '').toLowerCase();
      return String(r.id) === targetMeetingId ||
        (topic.includes('candela') && topic.includes('weekly'));
    });

    if (!selected) {
      throw new Error('Could not find the Candela Weekly Meeting recording');
    }

    if (!recordingHasTranscriptFile(selected)) {
      throw new Error('Candela Weekly Meeting recording found, but transcript is not ready yet');
    }

    Logger.log(`✅ Selected call: ${selected.topic} | ${selected.start_time} | ${selected.id}`);

    processRecordingWithParticipants(
      selected.id,
      selected.uuid || selected.id,
      selected.topic || 'Candela <> Spiralyze Weekly Meeting',
      selected.host_email || 'joao@spiralyze.com',
      {
        forceExternal: true,
        clientNameOverride: 'Candela',
        ignorePreviousContext: false
      }
    );

    logToSheet({
      status: 'TEST COMPLETE',
      meetingTopic: 'Test: Candela Weekly Meeting',
      error: `Successfully processed: ${selected.topic}`
    });

  } catch (error) {
    logToSheet({
      status: 'TEST FAILED',
      meetingTopic: 'Test: Candela Weekly Meeting',
      error: error.toString()
    });
    Logger.log('❌ Test failed: ' + error);
  }
}