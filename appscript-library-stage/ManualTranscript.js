// ═══════════════════════════════════════════════════════════
//  MANUAL / 3RD-PARTY TRANSCRIPT PROCESSING
// ═══════════════════════════════════════════════════════════

/**
 * Read transcript text from a Google Drive file.
 * Supports:
 * - Google Docs
 * - .txt files
 * - other plain text-like files
 */
function readTranscriptTextFromDrive(fileId) {
  const file = DriveApp.getFileById(fileId);
  const mimeType = file.getMimeType();

  // Google Doc
  if (mimeType === MimeType.GOOGLE_DOCS || mimeType === 'application/vnd.google-apps.document') {
    return DocumentApp.openById(fileId).getBody().getText();
  }

  // Plain text / uploaded txt / fallback
  return file.getBlob().getDataAsString('UTF-8');
}

function parseThirdPartyTranscript(rawText) {
  const normalizedText = normalizeRawTranscriptText(rawText);
  const lines = normalizedText.split(/\r?\n/);

  let currentSpeaker = '';
  let currentTimestamp = '';
  let currentText = [];
  const output = [];

  function flushCurrentBlock() {
    if (!currentSpeaker || !currentText.length) return;

    const mergedText = currentText
      .map(cleanTranscriptLine)
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!mergedText) return;

    output.push(
      `[${normalizeTimestamp(currentTimestamp)}] ${cleanThirdPartySpeakerName(currentSpeaker)}: ${mergedText}`
    );
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = String(rawLine || '').trim();

    if (!line) continue;

    if (
      line === '---' ||
      /^VIEW RECORDING/i.test(line) ||
      /^Call ended/i.test(line) ||
      /^Participants\b/i.test(line) ||
      /^ACTION ITEM:/i.test(line) ||
      /^SCREEN SHARING:/i.test(line)
    ) {
      continue;
    }

    // now supports optional @ before timestamp
    const speakerMatch = line.match(/^@?(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]\s*(.+)$/);

    if (speakerMatch) {
      flushCurrentBlock();

      currentTimestamp = speakerMatch[1];
      currentSpeaker = speakerMatch[2];
      currentText = [];
      continue;
    }

    if (currentSpeaker) {
      currentText.push(line);
    }
  }

  flushCurrentBlock();

  if (!output.length) {
    return parseThirdPartyTranscriptFallback(normalizedText);
  }

  return output.join('\n');
}

/**
 * Normalize timestamps to HH:MM:SS
 */
function normalizeTimestamp(ts) {
  const parts = String(ts || '').split(':').map(p => p.trim());

  if (parts.length === 2) {
    const mm = parts[0].padStart(2, '0');
    const ss = parts[1].padStart(2, '0');
    return `00:${mm}:${ss}`;
  }

  if (parts.length === 3) {
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    const ss = parts[2].padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  return '00:00:00';
}

/**
 * Remove noisy labels from transcript content lines
 */
function cleanTranscriptLine(line) {
  return String(line || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanThirdPartySpeakerName(name) {
  return String(name || '')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

/**
 * Extract participants from normalized transcript text
 */
function buildParticipantsFromTranscript(transcript) {
  const participantsMap = {};
  const lines = String(transcript || '').split('\n');

  lines.forEach(line => {
    const match = line.match(/^\[\d{2}:\d{2}:\d{2}\]\s+([^:]+):/);
    if (!match) return;

    const speakerName = match[1].trim();
    if (!participantsMap[speakerName]) {
      participantsMap[speakerName] = {
        name: speakerName,
        email: null,
        user_id: null
      };
    }
  });

  return Object.keys(participantsMap).map(key => participantsMap[key]);
}

function processManualTranscript(options) {
  const startTime = new Date();

  const meetingTopic = options.meetingTopic;
  const hostEmail = options.hostEmail || '';
  const transcriptText = options.transcriptText || '';
  const ignorePreviousContext = !!options.ignorePreviousContext;
  const meetingDate = options.meetingDate ? new Date(options.meetingDate) : new Date();

  logToSheet({
    status: 'STARTED',
    meetingTopic: meetingTopic,
    hostEmail: hostEmail,
    error: 'Processing manual / 3rd-party transcript'
  });

  try {
    if (!meetingTopic) {
      throw new Error('meetingTopic is required');
    }

    if (!transcriptText || !transcriptText.trim()) {
      throw new Error('Transcript text is empty');
    }

    const normalizedTranscript = parseThirdPartyTranscript(transcriptText);
    if (!normalizedTranscript || !normalizedTranscript.trim()) {
      throw new Error('Transcript could not be parsed into structured format');
    }

    const participants = buildParticipantsFromTranscript(normalizedTranscript);
    const isExternal = shouldTreatAsExternalClientCall(participants, meetingTopic);

    if (!isExternal) {
      throw new Error('This call is not classified as an external client call');
    }

    const externalParticipants = getExternalParticipants(participants);
    const internalParticipants = getInternalParticipants(participants);

    const clientName = extractClientName(meetingTopic) || 'Unknown Client';
    const pmName = extractPMNameFromParticipants(internalParticipants, meetingTopic);
    const adName = extractADNameFromParticipants(internalParticipants, meetingTopic);

    const clientJoinTimestamp = findFirstClientJoinTimestamp(normalizedTranscript, externalParticipants);
    const analysisTranscript = trimTranscriptToFirstClientJoin(normalizedTranscript, externalParticipants);

    const previousContext = ignorePreviousContext
      ? null
      : buildHistoricalContextBundle(clientName, null);

    const participantContext = appendAnalysisWindowContext(
      buildParticipantContext(participants, isExternal, externalParticipants),
      clientJoinTimestamp
    );

    const feedback = analyzeCallWithContext(
    analysisTranscript,
    clientName,
    pmName,
    adName,
    previousContext,
    participantContext,
    options.callType || 'client_weekly'   // ← ADD THIS
  );

    const futureContextSummary = extractFutureContextSummaryFromFeedback(feedback) || generateSummary(feedback);

    const docUrl = createBeautifulGoogleDoc(
      meetingTopic,
      clientName,
      pmName,
      adName,
      normalizedTranscript,
      feedback,
      meetingDate,
      externalParticipants,
      futureContextSummary
    );

    if (CONFIG.ENABLE_SLACK_POSTING) {
  sendIndividualFeedbackDMs(feedback, meetingTopic, normalizedTranscript, meetingDate);
}

    const manualMeetingId =
      'manual-' +
      clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
      '-' +
      Utilities.formatDate(meetingDate, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

    storeTranscriptWithDocLink(
      clientName,
      manualMeetingId,
      pmName,
      adName,
      normalizedTranscript,
      futureContextSummary,
      'SLACK_DISABLED',
      participants,
      isExternal,
      docUrl
    );

    const duration = (new Date() - startTime) / 1000;

    logToSheet({
      status: 'SUCCESS',
      meetingTopic: meetingTopic,
      clientName: clientName,
      hostEmail: hostEmail,
      hostName: pmName || adName || 'Unknown',
      role: getUserRole(hostEmail || ''),
      transcriptLength: normalizedTranscript.length,
      feedbackGenerated: true,
      error: `✅ Manual transcript processed in ${duration.toFixed(1)}s | ${ignorePreviousContext ? 'Forced first-call mode' : 'Used historical context'}`
    });

    Logger.log('📄 Coaching doc created successfully');
    Logger.log(docUrl);

    return {
      clientName: clientName,
      pmName: pmName,
      adName: adName,
      docUrl: docUrl,
      summary: futureContextSummary
    };

  } catch (error) {
    const duration = (new Date() - startTime) / 1000;

    logToSheet({
      status: 'ERROR',
      meetingTopic: meetingTopic || 'Manual Transcript',
      hostEmail: hostEmail,
      error: `${error.toString()} (after ${duration.toFixed(1)}s)`
    });

    throw error;
  }
}

function normalizeRawTranscriptText(text) {
  return String(text || '')
    .replace(/\u00A0/g, ' ')         // non-breaking space
    .replace(/[–—]/g, '-')           // en dash / em dash -> hyphen
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\n@(?=\d{1,2}:\d{2}(?::\d{2})?\s*-)/g, '\n') // remove @ before speaker timestamps
    .replace(/^@(?=\d{1,2}:\d{2}(?::\d{2})?\s*-)/, '')     // remove @ if first line starts with it
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

function parseThirdPartyTranscriptFallback(rawText) {
  const text = normalizeRawTranscriptText(rawText);

  const headerRegex = /(^|\n)@?(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(.+)/g;
  const matches = [];
  let match;

  while ((match = headerRegex.exec(text)) !== null) {
    matches.push({
      index: match.index + (match[1] ? match[1].length : 0),
      timestamp: match[2],
      speaker: match[3].trim()
    });
  }

  if (!matches.length) {
    return '';
  }

  const output = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i < matches.length - 1 ? matches[i + 1].index : text.length;

    const block = text.substring(start, end).trim();
    const lines = block.split('\n');
    const header = lines.shift() || '';
    const speakerMatch = header.match(/^@?(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(.+)$/);

    if (!speakerMatch) continue;

    const ts = speakerMatch[1];
    const speaker = speakerMatch[2];
    const body = lines
      .map(cleanTranscriptLine)
      .filter(Boolean)
      .filter(line =>
        !/^ACTION ITEM:/i.test(line) &&
        !/^SCREEN SHARING:/i.test(line) &&
        !/^VIEW RECORDING/i.test(line)
      )
      .join(' ')
      .trim();

    if (!body) continue;

    output.push(`[${normalizeTimestamp(ts)}] ${cleanThirdPartySpeakerName(speaker)}: ${body}`);
  }

  return output.join('\n');
}