// ═══════════════════════════════════════════════════════════
//  MAIN WEBHOOK HANDLER WITH IMPROVED GOOGLE DOCS
// ═══════════════════════════════════════════════════════════

/**
 * Webhook endpoint - handle multiple event types
 */
function doPost(e) {
  try {
    let rawBody = '';
    if (e && e.postData && e.postData.contents) {
      rawBody = e.postData.contents;
    } else if (e && e.postData && e.postData.getDataAsString) {
      rawBody = e.postData.getDataAsString();
    }

    Logger.log('=== doPost received ===');
    Logger.log('Raw body length: ' + rawBody.length);
    Logger.log('Raw body preview: ' + rawBody.substring(0, 300));

    if (!rawBody) {
      Logger.log('❌ Empty body — returning ok');
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'ok' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const payload = JSON.parse(rawBody);
    const event   = payload.event;

    Logger.log('Event parsed: ' + event);

    if (event === 'recording.completed' || event === 'recording.transcript_completed') {
      const object       = payload.payload.object;
      const meetingId    = object.id;
      const meetingUuid  = object.uuid;
      const meetingTopic = object.topic;
      const hostEmail    = object.host_email;

      logToSheet({
        status:       'INFO',
        meetingTopic: meetingTopic,
        hostEmail:    hostEmail,
        error:        'Webhook received via Cloudflare: ' + event
      });

      // Mirror to SpiralFolio admin event log. We log this as a
      // `cloudflare_webhook_received` event since the payload reaches us
      // exclusively through the Cloudflare worker — the Apps Script web app
      // is never called directly by Zoom.
      logSpiralFolioEvent({
        eventType:    'cloudflare_webhook_received',
        source:       'cloudflare',
        severity:     'info',
        message:      'Zoom ' + event + ' forwarded by Cloudflare worker — host: ' + hostEmail,
        meetingId:    meetingId,
        meetingTopic: meetingTopic,
        callDate:     object.start_time || null,
        payload:      { event: event, hostEmail: hostEmail },
      });
      logSpiralFolioEvent({
        eventType:    'zoom_webhook_received',
        source:       'appscript',
        severity:     'info',
        message:      'Zoom event "' + event + '" received for ' + meetingTopic,
        meetingId:    meetingId,
        meetingTopic: meetingTopic,
        callDate:     object.start_time || null,
        payload:      { event: event, hostEmail: hostEmail },
      });

      Logger.log('PM_AD_EMAILS count: ' + PM_AD_EMAILS.length);
      Logger.log('Host email: ' + hostEmail);
      Logger.log('Host is PM/AD: ' + PM_AD_EMAILS.some(function(e) {
        return e.toLowerCase() === hostEmail.toLowerCase();
      }));

      if (!PM_AD_EMAILS.some(function(email) {
        return email.toLowerCase() === hostEmail.toLowerCase();
      })) {
        logToSheet({
          status:       'SKIPPED',
          meetingTopic: meetingTopic,
          hostEmail:    hostEmail,
          error:        'Host is not a PM or AD'
        });
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'skipped' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const callType    = detectCallType(meetingTopic);
      const isNonClient = (callType === 'design_review' ||
                           callType === 'sales_call'    ||
                           callType === 'interview'     ||
                           callType === 'internal');

      // Pre-screen internal-only calls before queuing
      const looksInternal = !shouldTreatAsExternalClientCall([], meetingTopic);
      if (looksInternal && !isNonClient) {
        Logger.log('Pre-screen: skipping internal call — ' + meetingTopic);
        logToSheet({
          status:       'SKIPPED',
          meetingTopic: meetingTopic,
          hostEmail:    hostEmail,
          error:        'Pre-screened as internal — not queued'
        });
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'skipped_internal' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // ── Deduplicate Zoom's double-fire ─────────────────────────
      // Zoom sends both recording.completed AND recording.transcript_completed.
      // Check both the pending-job key AND the post-processing marker so that
      // a late-arriving second event (after the first job was already processed
      // and its WEBHOOK_JOB_ key deleted) is still blocked.
      const dateKey        = String(object.start_time || '').slice(0, 10).replace(/-/g, '') || 'nodate';
      const meetingDateKey = String(meetingId) + '_' + dateKey;
      const jobKey         = 'WEBHOOK_JOB_'  + meetingDateKey;
      const processedKey   = 'PROCESSED_'    + meetingDateKey;
      const scriptProps    = PropertiesService.getScriptProperties();
      const existingJob    = scriptProps.getProperty(jobKey);
      const alreadyDone    = scriptProps.getProperty(processedKey);

      if (existingJob || alreadyDone) {
        Logger.log('Job already ' + (existingJob ? 'queued' : 'processed') +
                   ' for this meeting+date — ignoring duplicate event: ' + meetingTopic);
        return ContentService
          .createTextOutput(JSON.stringify({
            status: existingJob ? 'already_queued' : 'already_processed'
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      scheduleWebhookProcessing({
        meetingId:     String(meetingId),
        meetingUuid:   meetingUuid,
        meetingTopic:  meetingTopic,
        hostEmail:     hostEmail,
        callType:      callType,
        forceExternal: isNonClient,
        startTime:     object.start_time || new Date().toISOString(),
      });
    }

    if (event === 'recording.trashed') {
      const object = payload.payload.object;
      logToSheet({
        status:       'WARNING',
        meetingTopic: object.topic      || 'Unknown',
        hostEmail:    object.host_email || 'Unknown',
        error:        'Recording was deleted/trashed'
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('doPost error: ' + error);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Zoom validation challenge handler ─────────────────────────
// Zoom sends: { event: 'endpoint.url_validation', payload: { plainToken: '...' } }
// We must respond with: { plainToken, encryptedToken (HMAC-SHA256 of plainToken) }
function handleZoomValidation(payload) {
  const plainToken  = payload.payload.plainToken;
  const secretToken = PropertiesService.getScriptProperties()
                        .getProperty('ZOOM_WEBHOOK_SECRET_TOKEN');

  if (!secretToken) {
    Logger.log('❌ ZOOM_WEBHOOK_SECRET_TOKEN not set');
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Secret token not configured' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  Logger.log('plainToken received: ' + plainToken);

  // Apps Script returns signed bytes — must convert to unsigned hex correctly
  const hmac = Utilities.computeHmacSha256Signature(plainToken, secretToken);

  const encryptedToken = hmac.map(function(b) {
    // Convert signed byte to unsigned, then to 2-digit hex
    const unsigned = (b + 256) % 256;
    const hex      = unsigned.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');

  Logger.log('encryptedToken: ' + encryptedToken);
  Logger.log('encryptedToken length: ' + encryptedToken.length + ' (should be 64)');

  const responseBody = JSON.stringify({
    plainToken:     plainToken,
    encryptedToken: encryptedToken
  });

  Logger.log('Sending response: ' + responseBody);

  return ContentService
    .createTextOutput(responseBody)
    .setMimeType(ContentService.MimeType.JSON);
}


// ── Background job scheduler ───────────────────────────────────
// Stores the job in ScriptProperties, fires a 1-minute trigger.
// doPost returns immediately; processing happens in the triggered function.
function scheduleWebhookProcessing(jobData) {
  const props  = PropertiesService.getScriptProperties();
  // Use meetingId + date as key so recurring meetings don't overwrite each other
  const dateKey = jobData.meetingId + '_' + (jobData.startTime
    ? String(jobData.startTime).slice(0, 10).replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const jobKey = 'WEBHOOK_JOB_' + dateKey;

  props.setProperty(jobKey, JSON.stringify(jobData));
  Logger.log('📥 Job queued: ' + jobData.meetingTopic + ' | Key: ' + jobKey);
}

// ── Background job processor ───────────────────────────────────
// Called by the time-based trigger every 5 minutes.
// Processes ONE job per invocation to stay within Apps Script's
// 6-minute execution limit. Remaining jobs are picked up on
// subsequent trigger runs.
function processWebhookJob() {
  const props    = PropertiesService.getScriptProperties();
  const allProps = props.getProperties();

  const jobKeys = Object.keys(allProps).filter(function(k) {
    return k.startsWith('WEBHOOK_JOB_');
  });

  if (jobKeys.length === 0) {
    Logger.log('No webhook jobs queued');
    return;
  }

  Logger.log('Found ' + jobKeys.length + ' queued job(s) — processing 1 this run');

  // Take only the first job; the trigger will handle the rest on future runs.
  const jobKey = jobKeys[0];
  let jobData;
  try {
    jobData = JSON.parse(allProps[jobKey]);
  } catch (e) {
    Logger.log('Could not parse job ' + jobKey + ' — removing');
    props.deleteProperty(jobKey);
    return;
  }

  // Remove from queue before processing so a timeout doesn't leave a
  // stuck key. (A new PROCESSED_ marker is written on success.)
  props.deleteProperty(jobKey);

  Logger.log('▶ Processing: ' + jobData.meetingTopic);

  try {
    processWithRetry(
      jobData.meetingId,
      jobData.meetingUuid || jobData.meetingId,
      jobData.meetingTopic,
      jobData.hostEmail,
      {
        callType:      jobData.callType      || 'client_weekly',
        forceExternal: !!jobData.forceExternal,
      },
      2
    );
    Logger.log('✅ Job complete: ' + jobData.meetingTopic);

    // Mark this meeting+date as fully processed so any late-arriving Zoom
    // event (recording.transcript_completed arriving after this key was
    // deleted) does not re-queue and double-post to SpiralFolio.
    var datePart = jobData.startTime
      ? String(jobData.startTime).slice(0, 10).replace(/-/g, '')
      : 'nodate';
    props.setProperty('PROCESSED_' + jobData.meetingId + '_' + datePart, new Date().toISOString());

    if (jobKeys.length > 1) {
      Logger.log((jobKeys.length - 1) + ' job(s) still queued — will process on next trigger run');
    }
  } catch (e) {
    Logger.log('❌ Job failed: ' + jobData.meetingTopic + ' | ' + e);
    logToSheet({
      status:       'ERROR',
      meetingTopic: jobData.meetingTopic,
      hostEmail:    jobData.hostEmail || '',
      error:        'Webhook job failed: ' + e.toString()
    });
  }
}

function setupPermanentWebhookTrigger() {
  // Delete any existing processWebhookJob triggers first
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'processWebhookJob') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log('Deleted old trigger');
    }
  });

  // Create a permanent every-5-minutes trigger
  ScriptApp.newTrigger('processWebhookJob')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('✅ Permanent 5-minute trigger created for processWebhookJob');
  Logger.log('Zoom webhooks will now be processed within 5 minutes of arrival');
}

function doGet() {
  return jsonResponse({
    status: 'ok',
    message: 'Zoom validation test endpoint'
  });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function processRecordingWithParticipants(meetingId, meetingUuid, meetingTopic, hostEmail, options) {
  options = options || {};

  const startTime             = new Date();
  const forceExternal         = !!options.forceExternal;
  const callType              = options.callType || 'client_weekly';
  const clientNameOverride    = options.clientNameOverride  || null;
  const pmNameOverride        = options.pmNameOverride      || null;
  const adNameOverride        = options.adNameOverride      || null;
  const ignorePreviousContext = !!options.ignorePreviousContext;
  const skipDuplicateCheck    = !!options.skipDuplicateCheck;

  const bypassExternalCheck = forceExternal ||
    callType === 'design_review' ||
    callType === 'sales_call'    ||
    callType === 'interview'     ||
    callType === 'internal';

  // ── DUPLICATE CHECK ────────────────────────────────────────────
  if (!skipDuplicateCheck) {
    const alreadyDone = isRecordingAlreadyProcessed({
      id:         meetingId,
      topic:      meetingTopic,
      start_time: options.recordingData
        ? options.recordingData.start_time
        : null   // null = date unknown, skip date-based ID check
    });

    if (alreadyDone) {
      Logger.log('⏭️ Already processed — skipping: ' + meetingTopic + ' (' + meetingId + ')');
      logToSheet({
        status:       'SKIPPED',
        meetingTopic: meetingTopic,
        hostEmail:    hostEmail,
        error:        'Already processed — duplicate prevented'
      });
      return;
    }
  }

  logToSheet({
    status:       'STARTED',
    meetingTopic: meetingTopic,
    hostEmail:    hostEmail,
    error:        'Processing meeting ID: ' + meetingId
  });

  logSpiralFolioEvent({
    eventType:    'appscript_processing_started',
    source:       'appscript',
    severity:     'info',
    message:      'Apps Script started processing ' + meetingTopic,
    meetingId:    meetingId,
    meetingTopic: meetingTopic,
    payload:      { hostEmail: hostEmail, callType: callType, forceExternal: forceExternal },
  });

  try {
    const token = getZoomAccessToken();

    const recording = options.recordingData || getRecordingDetails(meetingId, token);
    if (!recording) {
      throw new Error('Recording not found');
    }

    if (!recordingHasTranscriptFile(recording)) {
      logToSheet({
        status:       'SKIPPED',
        meetingTopic: meetingTopic,
        hostEmail:    hostEmail,
        error:        'Skipped because no transcript file exists'
      });
      return;
    }

    const participants        = getParticipantDetails(meetingId, meetingUuid, token);
    let   isExternal          = shouldTreatAsExternalClientCall(participants, meetingTopic);

    if (bypassExternalCheck) {
      isExternal = true;
    }

    const externalParticipants = getExternalParticipants(participants);
    const internalParticipants = getInternalParticipants(participants);

    if (!isExternal) {
      logToSheet({
        status:       'SKIPPED',
        meetingTopic: meetingTopic,
        hostEmail:    hostEmail,
        error:        'Skipped because this is not an external client call'
      });
      return;
    }

    logToSheet({
      status:       'INFO',
      meetingTopic: meetingTopic,
      hostEmail:    hostEmail,
      error:        'Participants: ' + participants.length + ' total | Call type: ' + callType
    });

    const transcript = downloadTranscript(recording, token);
    if (!transcript) {
      throw new Error('Transcript download failed or returned empty');
    }

    const analysisTranscript = bypassExternalCheck && externalParticipants.length === 0
      ? transcript
      : trimTranscriptToFirstClientJoin(transcript, externalParticipants);

    const clientName = clientNameOverride
      || extractClientName(meetingTopic)
      || 'Unknown';

    const pmName = pmNameOverride
      || extractPMNameFromParticipants(internalParticipants, meetingTopic);

    const adName = adNameOverride
      || extractADNameFromParticipants(internalParticipants, meetingTopic);

    const _clientLookup = lookupClientTeam(clientName);
    const _pmCanonical  = (_clientLookup && _clientLookup.pm ? _clientLookup.pm : pmName || '').toLowerCase();
    const _adCanonical  = (_clientLookup && _clientLookup.ad ? _clientLookup.ad : adName || '').toLowerCase();

    const additionalInternalNames = internalParticipants
      .map(p => p.canonicalName || p.name || '')
      .filter(Boolean)
      .filter(name => {
        const n = name.toLowerCase();
        return !n.includes(_pmCanonical) &&
               !_pmCanonical.includes(n) &&
               !n.includes(_adCanonical) &&
               !_adCanonical.includes(n);
      })
      .filter((name, idx, arr) => arr.indexOf(name) === idx);

    const clientJoinTimestamp = bypassExternalCheck && externalParticipants.length === 0
      ? null
      : findFirstClientJoinTimestamp(transcript, externalParticipants);

    const previousContext = ignorePreviousContext
      ? null
      : buildHistoricalContextBundle(clientName, null);

    const participantContext = appendAnalysisWindowContext(
      buildParticipantContext(participants, isExternal, externalParticipants),
      clientJoinTimestamp
    );

    const feedback = analyzeCallWithContext(
      analysisTranscript, clientName, pmName, adName,
      previousContext, participantContext, callType,
      additionalInternalNames
    );

    const futureContextSummary = extractFutureContextSummaryFromFeedback(feedback)
      || generateSummary(feedback);

    const docUrl = createBeautifulGoogleDoc(
      meetingTopic, clientName, pmName, adName,
      transcript, feedback, recording.start_time,
      externalParticipants, futureContextSummary
    );

    logSpiralFolioEvent({
      eventType:    'coaching_doc_created',
      source:       'appscript',
      severity:     'success',
      message:      'Coaching doc created for ' + clientName + ' (' + meetingTopic + ')',
      meetingId:    meetingId,
      meetingTopic: meetingTopic,
      clientName:   clientName,
      callDate:     recording.start_time || null,
      docUrl:       docUrl || null,
      payload:      { pmName: pmName, adName: adName, callType: callType },
    });

    if (CONFIG.ENABLE_SLACK_POSTING) {
      sendIndividualFeedbackDMs(feedback, meetingTopic, transcript, recording.start_time, {
        clientName: clientName,
        meetingId:  meetingId,
        docUrl:     docUrl,
      });
    }

    // ── SpiralFolio brain update ────────────────────────────────
    // Non-blocking: errors are logged but never thrown.
    postToSpiralFolio({
      clientName: clientName,
      transcript: analysisTranscript,
      callDate:   recording.start_time,
      callType:   callType,
      pmName:     pmName,
      adName:     adName,
    });

    // CHANGED: pass recording.start_time so the sheet stores the actual call date
    storeTranscriptWithDocLink(
      clientName, meetingId, pmName, adName,
      transcript, futureContextSummary, 'SLACK_DISABLED',
      participants, isExternal, docUrl,
      recording.start_time   // ← actual recording date
    );

    const duration = (new Date() - startTime) / 1000;

    logToSheet({
      status:            'SUCCESS',
      meetingTopic:      meetingTopic,
      clientName:        clientName,
      hostEmail:         hostEmail,
      hostName:          pmName || adName || 'Unknown',
      role:              getUserRole(hostEmail || ''),
      transcriptLength:  analysisTranscript.length,
      feedbackGenerated: true,
      error:             '✅ Completed in ' + duration.toFixed(1) + 's | Type: ' + callType + ' | ' +
                         (ignorePreviousContext ? 'Forced first-call mode' : 'Used historical context')
    });

    Logger.log('🎉 Coaching doc created successfully');
    Logger.log(docUrl);

    logSpiralFolioEvent({
      eventType:    'appscript_processing_completed',
      source:       'appscript',
      severity:     'success',
      message:      'Apps Script finished processing ' + meetingTopic + ' in ' + duration.toFixed(1) + 's',
      meetingId:    meetingId,
      meetingTopic: meetingTopic,
      clientName:   clientName,
      callDate:     recording.start_time || null,
      docUrl:       docUrl || null,
      payload:      {
        durationSec:  duration,
        pmName:       pmName,
        adName:       adName,
        callType:     callType,
      },
    });

    return { clientName, pmName, adName, docUrl, summary: futureContextSummary };

  } catch (error) {
    const duration = (new Date() - startTime) / 1000;
    logToSheet({
      status:       'ERROR',
      meetingTopic: meetingTopic,
      hostEmail:    hostEmail,
      error:        error.toString() + ' (after ' + duration.toFixed(1) + 's)'
    });
    logSpiralFolioEvent({
      eventType:    'appscript_processing_error',
      source:       'appscript',
      severity:     'error',
      message:      'Apps Script processing failed for ' + meetingTopic + ' — ' + error,
      meetingId:    meetingId,
      meetingTopic: meetingTopic,
      payload:      { error: String(error), durationSec: duration, hostEmail: hostEmail },
    });
    throw error;
  }
}

function createBeautifulGoogleDoc(meetingTopic, clientName, pmName, adName, transcript, feedback, startTime, externalParticipants, futureContextSummary) {
  try {
    const folderId = getOrCreateDocsFolder();
    const folder = DriveApp.getFolderById(folderId);

    const date = new Date(startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const docName = `${clientName || 'Unknown Client'} - ${date} - Call Coaching`;

    const doc = DocumentApp.create(docName);
    const docId = doc.getId();

    const file = DriveApp.getFileById(docId);
    file.moveTo(folder);

    const body = doc.getBody();
    body.clear();

    const style = {};
    style[DocumentApp.Attribute.SPACING_AFTER] = 8;
    style[DocumentApp.Attribute.LINE_SPACING] = 1.15;
    body.setAttributes(style);

    const titlePara = body.appendParagraph(meetingTopic);
    titlePara.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    titlePara.setForegroundColor('#1a73e8');
    titlePara.setSpacingAfter(20);

    body.appendParagraph('');

    const metaTable = body.appendTable([
      ['📅 Date', new Date(startTime).toLocaleString()],
      ['🏢 Client', clientName || 'Unknown'],
      ['👤 Project Manager', pmName || 'Unknown'],
      ['👤 Account Director', adName || 'Unknown'],
      ['🤖 AI Provider', getActiveAIProvider()]
    ]);

    metaTable.setBorderWidth(1);
    metaTable.setBorderColor('#cccccc');
    metaTable.setColumnWidth(0, 150);

    for (let i = 0; i < metaTable.getNumRows(); i++) {
      const cell = metaTable.getRow(i).getCell(0);
      cell.setBackgroundColor('#f3f3f3');
      cell.editAsText().setBold(true);
    }

    if (externalParticipants && externalParticipants.length > 0) {
      const externalNames = externalParticipants
        .map(p => `${p.name || 'Unknown'} (${p.email || 'No email'})`)
        .join(', ');

      body.appendParagraph('');
      const clientPara = body.appendParagraph(`👥 Client Attendees: ${externalNames}`);
      clientPara.setItalic(true);
      clientPara.setForegroundColor('#5f6368');
      clientPara.setSpacingAfter(20);
    }

    body.appendParagraph('');
    body.appendHorizontalRule();
    body.appendParagraph('');

    const feedbackTitle = body.appendParagraph('🎯 COACHING FEEDBACK');
    feedbackTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
    feedbackTitle.setForegroundColor('#1a73e8');
    feedbackTitle.setSpacingBefore(15);
    feedbackTitle.setSpacingAfter(15);

    formatCoachingFeedback(body, feedback);   

    body.appendParagraph('');
    body.appendHorizontalRule();
    body.appendParagraph('');

    if (futureContextSummary && futureContextSummary.trim()) {
  const summaryTitle = body.appendParagraph('SUMMARY FOR FUTURE CONTEXT');
  summaryTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  summaryTitle.setForegroundColor('#188038');
  summaryTitle.setSpacingBefore(15);
  summaryTitle.setSpacingAfter(10);

  body.appendParagraph(futureContextSummary.trim());
}

    body.appendParagraph('');
    body.appendHorizontalRule();
    body.appendParagraph('');

    const reviewerTitle = body.appendParagraph('PM / AD FEEDBACK FOR MODEL IMPROVEMENT');
    reviewerTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
    reviewerTitle.setForegroundColor('#7b1fa2');
    reviewerTitle.setSpacingBefore(15);
    reviewerTitle.setSpacingAfter(10);

    body.appendParagraph('Paste PM / AD feedback here after reviewing the coaching.');
    body.appendParagraph('Suggested structure:');
    body.appendParagraph('• What was useful');
    body.appendParagraph('• What was inaccurate');
    body.appendParagraph('• What was missing');
    body.appendParagraph('• Correct interpretation');
    body.appendParagraph('• Preferred future behavior');
    body.appendParagraph('• Tone/style preference');

    body.appendPageBreak();

    const transcriptTitle = body.appendParagraph('FULL CALL TRANSCRIPT');
    transcriptTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);
    transcriptTitle.setForegroundColor('#34a853');
    transcriptTitle.setSpacingBefore(15);
    transcriptTitle.setSpacingAfter(15);

    body.appendParagraph('');
    formatTranscript(body, transcript);

    doc.saveAndClose();
    return doc.getUrl();

  } catch (error) {
    Logger.log('Error creating Google Doc: ' + error);
    throw new Error('Failed to create Google Doc: ' + error);
  }
}
/**
 * Format coaching feedback with strong visual hierarchy
 */
/**
 * Format coaching feedback with strong visual hierarchy.
 * No hyperlinks on timestamps — plain text only.
 */
function formatCoachingFeedback(body, feedback) {
  const lines = feedback.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line    = rawLine.trim();

    if (!line) {
      body.appendParagraph('');
      continue;
    }

    // ── Numbered section headings: **1. EXECUTIVE SUMMARY** etc.
    if (/^\*\*\d+\./.test(line)) {
      const clean = line.replace(/\*\*/g, '').trim();
      const heading = body.appendParagraph(clean);
      heading.setHeading(DocumentApp.ParagraphHeading.HEADING2);
      heading.setForegroundColor('#1a73e8');
      heading.setSpacingBefore(14);
      heading.setSpacingAfter(6);
      continue;
    }

    // ── INDIVIDUAL FEEDBACK headings
    if (/^\*\*INDIVIDUAL FEEDBACK/.test(line)) {
      const clean = line.replace(/\*\*/g, '').trim();
      const heading = body.appendParagraph(clean);
      heading.setHeading(DocumentApp.ParagraphHeading.HEADING2);
      heading.setForegroundColor('#e8710a');
      heading.setSpacingBefore(14);
      heading.setSpacingAfter(6);
      continue;
    }

    // ── Any other bold heading (e.g. **TEAM-LEVEL FEEDBACK**)
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      const clean = line.replace(/\*\*/g, '').trim();
      const heading = body.appendParagraph(clean);
      heading.setHeading(DocumentApp.ParagraphHeading.HEADING3);
      heading.setForegroundColor('#188038');
      heading.setSpacingBefore(10);
      heading.setSpacingAfter(4);
      continue;
    }

    // ── Bullet points: lines starting with •, -, or *
    if (isBulletLine(line)) {
      appendBullet(body, cleanBulletText(line));
      continue;
    }

    // ── Horizontal rule
    if (/^---+$/.test(line)) {
      body.appendHorizontalRule();
      continue;
    }

    // ── Normal paragraph
    appendRichParagraph(body, cleanMarkdown(rawLine), {
      fontSize:     11,
      color:        '#202124',
      spacingAfter: 5
    });
  }
}

/**
 * Format transcript with color-coded speaker names and styled timestamps.
 */
function formatTranscript(body, transcript) {
  const lines = transcript.split('\n');

  // Cycle through 5 distinct colors — one per unique speaker
  const SPEAKER_COLORS = [
    '#0b57d0', // blue
    '#b3261e', // red
    '#188038', // green
    '#9334e6', // purple
    '#e37400', // orange
  ];
  const speakerColors = {};
  let colorIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line    = rawLine.trim();

    if (!line) {
      body.appendParagraph('');
      continue;
    }

    // Match VTT-style speaker lines: [HH:MM:SS] Speaker Name: dialogue
    // or **[HH:MM:SS]** **Speaker [Role]**: dialogue
    const speakerMatch = line.match(
      /^(?:\*\*)?\[(\d{1,2}:\d{2}:\d{2})\](?:\*\*)?\s+(?:\*\*)?([^:*\[]+?)(?:\s*\[[^\]]*\])?(?:\*\*)?:\s*(.*)$/
    );

    if (speakerMatch) {
      const timestamp = speakerMatch[1]; // e.g. "00:08:14"
      const speaker   = speakerMatch[2].trim();
      const dialogue  = speakerMatch[3].trim();

      // Assign a color to this speaker if not seen before
      if (!speakerColors[speaker]) {
        speakerColors[speaker] = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
        colorIndex++;
      }
      const color = speakerColors[speaker];

      // Build paragraph with inline styling:
      // [timestamp]  SPEAKER NAME: dialogue
      const para = body.appendParagraph('');
      para.setSpacingBefore(1);
      para.setSpacingAfter(1);

      const textEl = para.editAsText();

      // Timestamp portion — grey, small
      const tsText = '[' + timestamp + ']  ';
      para.appendText(tsText);
      textEl.setFontSize(0, tsText.length - 1, 9);
      textEl.setForegroundColor(0, tsText.length - 1, '#888888');

      // Speaker name — colored, bold
      const speakerText = speaker + ': ';
      const speakerStart = tsText.length;
      para.appendText(speakerText);
      textEl.setFontSize(speakerStart, speakerStart + speakerText.length - 1, 10);
      textEl.setForegroundColor(speakerStart, speakerStart + speakerText.length - 1, color);
      textEl.setBold(speakerStart, speakerStart + speakerText.length - 1, true);

      // Dialogue — normal, dark
      if (dialogue) {
        const dialogueStart = speakerStart + speakerText.length;
        para.appendText(dialogue);
        textEl.setFontSize(dialogueStart, dialogueStart + dialogue.length - 1, 10);
        textEl.setForegroundColor(dialogueStart, dialogueStart + dialogue.length - 1, '#202124');
        textEl.setBold(dialogueStart, dialogueStart + dialogue.length - 1, false);
      }

    } else {
      // Non-speaker line (section headers, plain text in transcript)
      const para = body.appendParagraph(line.replace(/\*\*/g, ''));
      para.setFontSize(9);
      para.setForegroundColor('#555555');
      para.setSpacingBefore(1);
      para.setSpacingAfter(1);
    }
  }
}

// ── HELPERS ───────────────────────────────────────────────────────

function isBulletLine(line) {
  return /^[•\-\*]\s/.test(line) || /^\d+\.\s/.test(line);
}

function cleanBulletText(line) {
  return cleanMarkdown(line.replace(/^[•\-\*\d\.]+\s*/, ''));
}

function cleanMarkdown(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // strip **bold**
    .replace(/\*([^*]+)\*/g, '$1')     // strip *italic*
    .trim();
}

// REPLACE appendBullet with this:
function appendBullet(body, text) {
  const item = body.appendListItem(text);
  item.setGlyphType(DocumentApp.GlyphType.BULLET);
  item.setFontSize(11);
  item.setForegroundColor('#202124');
  item.setSpacingBefore(5);   // was 2
  item.setSpacingAfter(5);    // was 2
  item.setIndentStart(18);
  item.setIndentFirstLine(0);
  item.setNestingLevel(0);
}

function appendRichParagraph(body, text, opts) {
  opts = opts || {};
  const para = body.appendParagraph(text);
  para.setFontSize(opts.fontSize  || 11);
  para.setForegroundColor(opts.color || '#202124');
  para.setSpacingBefore(opts.spacingBefore || 0);
  para.setSpacingAfter(opts.spacingAfter  || 5);
}

/**
 * Helpers
 */
function appendSectionHeader(body, text, textColor, bgColor) {
  const table = body.appendTable([[text]]);
  table.setBorderWidth(0);

  const cell = table.getRow(0).getCell(0);
  cell.setBackgroundColor(bgColor);

  const para = cell.getChild(0).asParagraph();
  para.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  para.setAttributes({
    [DocumentApp.Attribute.SPACING_BEFORE]: 10,
    [DocumentApp.Attribute.SPACING_AFTER]: 6
  });

  const t = para.editAsText();
  if (t.getText().length > 0) {
    t.setBold(true);
    t.setFontSize(13);
    t.setForegroundColor(0, t.getText().length - 1, textColor);
  }

  body.appendParagraph('');
}

function appendStyledLine(body, text, options) {
  const para = body.appendParagraph(text || '');
  if (options.heading) para.setHeading(options.heading);
  if (options.align) para.setAlignment(options.align);

  para.setAttributes({
    [DocumentApp.Attribute.SPACING_BEFORE]: options.spacingBefore || 0,
    [DocumentApp.Attribute.SPACING_AFTER]: options.spacingAfter || 0,
    [DocumentApp.Attribute.LINE_SPACING]: options.lineSpacing || 1.15
  });

  if (text && text.length > 0) {
    const t = para.editAsText();
    if (options.fontSize) t.setFontSize(0, text.length - 1, options.fontSize);
    if (options.color) t.setForegroundColor(0, text.length - 1, options.color);
    if (options.bold) t.setBold(0, text.length - 1, true);
    if (options.italic) t.setItalic(0, text.length - 1, true);
  }

  return para;
}

function applyInlineBold(textElement, originalText) {
  if (!originalText || originalText.indexOf('**') === -1) return;

  let current = textElement.getText();
  let searchStart = 0;

  while (true) {
    const start = current.indexOf('**', searchStart);
    if (start === -1) break;

    const end = current.indexOf('**', start + 2);
    if (end === -1) break;

    textElement.deleteText(end, end + 1);
    textElement.deleteText(start, start + 1);

    current = textElement.getText();
    const boldEnd = end - 2;

    if (boldEnd >= start) {
      textElement.setBold(start, boldEnd, true);
    }

    searchStart = boldEnd + 1;
  }
}

function isMainSectionHeading(line) {
  return /^\s*(?:#{1,6}\s*)?\d+\.\s+/.test(line) ||
         /^\s*[🎯🚩😟✨💚📊💡📝🔄]\s+/.test(line);
}

function isSubheadingLine(line) {
  const cleaned = cleanMarkdown(line);
  return cleaned.endsWith(':') && cleaned.length < 80;
}


function getHeadingPalette(text) {
  if (text.indexOf('🚩') !== -1) return { textColor: '#b3261e', bgColor: '#fce8e6' };
  if (text.indexOf('😟') !== -1) return { textColor: '#a142f4', bgColor: '#f3e8fd' };
  if (text.indexOf('✨') !== -1) return { textColor: '#e37400', bgColor: '#fef7e0' };
  if (text.indexOf('💚') !== -1) return { textColor: '#188038', bgColor: '#e6f4ea' };
  if (text.indexOf('📊') !== -1) return { textColor: '#174ea6', bgColor: '#e8f0fe' };
  if (text.indexOf('💡') !== -1) return { textColor: '#7b1fa2', bgColor: '#f3e8fd' };
  if (text.indexOf('📝') !== -1) return { textColor: '#0b57d0', bgColor: '#e8f0fe' };
  if (text.indexOf('🔄') !== -1) return { textColor: '#5f6368', bgColor: '#f1f3f4' };
  return { textColor: '#0b57d0', bgColor: '#e8f0fe' };
}

function getOrCreateDocsFolder() {
  const scriptProps = PropertiesService.getScriptProperties();
  let folderId = scriptProps.getProperty('COACHING_DOCS_FOLDER_ID');

  if (folderId) {
    try {
      DriveApp.getFolderById(folderId);
      return folderId;
    } catch (error) {
      folderId = null;
    }
  }

  const folderName = 'Client Call Coaching - Transcripts & Feedback';
  const folder = DriveApp.createFolder(folderName);
  folderId = folder.getId();
  scriptProps.setProperty('COACHING_DOCS_FOLDER_ID', folderId);
  Logger.log(`Created coaching docs folder: ${folder.getUrl()}`);
  return folderId;
}

function storeTranscriptWithDocLink(clientName, meetingId, pmName, adName,
                                     transcript, summary, slackChannel,
                                     participants, isExternal, docUrl,
                                     recordingDate) {
  try {
    const sheet = getTranscriptSheet();

    const externalParticipantNames = getExternalParticipants(participants)
      .map(p => p.name)
      .filter(Boolean)
      .join(', ');

    // CHANGED: use actual recording date instead of new Date()
    const rowDate = recordingDate ? new Date(recordingDate) : new Date();

    const row = [
      rowDate,                                          // col 1  Actual call date
      clientName  || 'Unknown',                         // col 2  Client Name
      String(meetingId),                                // col 3  Meeting ID (as string)
      pmName      || 'Unknown',                         // col 4  PM Name
      adName      || 'Unknown',                         // col 5  AD Name
      summary,                                          // col 6  Summary
      isExternal ? 'External' : 'Internal',             // col 7  Meeting Type
      externalParticipantNames || 'N/A',                // col 8  External Participants
      docUrl || '',                                     // col 9  Doc URL
      getActiveAIProvider()                             // col 10 AI Provider
    ];

    sheet.appendRow(row);

    const lastRow = sheet.getLastRow();
    const maxCols = sheet.getMaxColumns();

    // CHANGED: force col 3 (meeting ID) to plain text format
    // prevents Google Sheets from converting large numbers to scientific notation
    if (maxCols >= 3) {
      sheet.getRange(lastRow, 3).setNumberFormat('@STRING@');
    }

    // Set hyperlink formula on doc URL cell (col 9)
    if (docUrl && maxCols >= 9) {
      const docLinkCell = sheet.getRange(lastRow, 9);
      docLinkCell.setFormula('=HYPERLINK("' + docUrl + '", "🎉 View Full Document")');
      docLinkCell.setFontColor('#1155cc');
      docLinkCell.setFontWeight('bold');
    }

  } catch (error) {
    Logger.log('Error storing transcript: ' + error);
  }
}

function processClientCall(meetingId, meetingTopic) {
  const token = getZoomAccessToken();
  const recording = getRecordingDetails(meetingId, token);

  if (!recording) {
    throw new Error('Recording not found');
  }

  processRecordingWithParticipants(
    meetingId,
    meetingId,
    meetingTopic,
    recording.host_email
  );
}

function generateSummary(feedback) {
  const lines = feedback.split('\n');
  let summary = '';

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    summary += lines[i] + '\n';
    if (summary.length > 300) break;
  }

  return summary.substring(0, 300);
}

function dailyBatchProcessRecordings() {
  const batchStart = new Date();

  logToSheet({
    status: 'INFO',
    meetingTopic: 'Daily Batch Job Started',
    error: `Time: ${batchStart.toLocaleString()}`
  });

  try {
    const token = getZoomAccessToken();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recordings = fetchAllPMandADRecordings(token, yesterday, today);

    let processed = 0;
    let errors = 0;

    recordings.forEach((recording, index) => {
      try {
        processClientCall(recording.id, recording.topic);
        processed++;
      } catch (error) {
        errors++;
      }

      if (index < recordings.length - 1) {
        Utilities.sleep(2000);
      }
    });

    const duration = (new Date() - batchStart) / 1000;
    logToSheet({
      status: 'SUCCESS',
      meetingTopic: 'Daily Batch Job Complete',
      error: `Processed: ${processed}, Errors: ${errors}, Duration: ${duration.toFixed(1)}s`
    });

  } catch (error) {
    logToSheet({
      status: 'ERROR',
      meetingTopic: 'Daily Batch Job Failed',
      error: error.toString()
    });
  }
}

function simulateZoomRecordingWebhook() {
  const webAppUrl = 'https://zoom-coaching-webhook.siddarth-d6c.workers.dev/';

  const fakePayload = {
    event: 'recording.completed',
    payload: {
      object: {
        id: '86418413689',
        uuid: 'test-uuid-12345',
        topic: 'TechSmith <> Spiralyze | Weekly CRO Meeting',
        host_email: 'furqaan@spiralyze.com',
        start_time: new Date().toISOString(),
        recording_files: [
          {
            file_type: 'TRANSCRIPT',
            download_url: 'https://example.com/test-transcript',
            recording_type: 'audio_transcript'
          }
        ]
      }
    }
  };

  const response = UrlFetchApp.fetch(webAppUrl, {
    method:             'post',
    contentType:        'application/json',
    payload:            JSON.stringify(fakePayload),
    muteHttpExceptions: true
  });

  Logger.log('Cloudflare response: ' + response.getResponseCode());
  Logger.log('Body: ' + response.getContentText());
}

function logWebAppUrl() {
  const url = ScriptApp.getService().getUrl();
  Logger.log('Active web app URL: ' + url);
}

function testValidationResponseFormat() {
  // Exactly replicate what handleZoomValidation sends
  const testPlainToken = 'abc123test';
  const secretToken    = PropertiesService.getScriptProperties()
                           .getProperty('ZOOM_WEBHOOK_SECRET_TOKEN');

  const hmac           = Utilities.computeHmacSha256Signature(testPlainToken, secretToken);
  const encryptedToken = hmac.map(function(b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');

  const responseBody = JSON.stringify({
    plainToken:     testPlainToken,
    encryptedToken: encryptedToken
  });

  Logger.log('Response body: ' + responseBody);
  Logger.log('Body length: ' + responseBody.length);
  Logger.log('Encrypted token length: ' + encryptedToken.length + ' (must be 64 chars)');
  Logger.log(encryptedToken.length === 64 ? '✅ Token length correct' : '❌ Token length WRONG');
}

function authorizeTriggerScope() {
  // Running this manually forces Apps Script to request
  // the script.scriptapp permission from you interactively
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log('Current triggers: ' + triggers.length);
  Logger.log('✅ ScriptApp scope authorized');
}