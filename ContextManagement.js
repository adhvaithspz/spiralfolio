// ═══════════════════════════════════════════════════════════
//  CONTEXT MANAGEMENT VIA GOOGLE SHEET + GOOGLE DOCS
// ═══════════════════════════════════════════════════════════

const DOC_SECTION_MARKERS = [
  'COACHING FEEDBACK',
  'SUMMARY FOR FUTURE CONTEXT',
  'PM / AD FEEDBACK FOR MODEL IMPROVEMENT',
  'FULL CALL TRANSCRIPT'
];

/**
 * Check whether a recording has a transcript file
 */
function recordingHasTranscriptFile(recording) {
  const files = (recording && recording.recording_files) ? recording.recording_files : [];
  return files.some(file =>
    file.file_type === 'TRANSCRIPT' || file.recording_type === 'audio_transcript'
  );
}

/**
 * Build one combined historical context block from:
 * 1) prior call summaries
 * 2) client-specific PM/AD feedback from prior docs
 *
 * CHANGED: added detailed terminal logging throughout
 */
function buildHistoricalContextBundle(clientName, excludeMeetingId) {
  Logger.log('');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📚 HISTORICAL CONTEXT LOOKUP');
  Logger.log('   Client:              ' + (clientName || 'NONE'));
  Logger.log('   Excluding meetingId: ' + (excludeMeetingId || 'none'));

  if (!clientName) {
    Logger.log('   ⚠️  No client name provided — skipping context lookup');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return null;
  }

  const recentCalls = getRecentClientCallRows(clientName, excludeMeetingId);

  if (!recentCalls.length) {
    Logger.log('   ℹ️  No previous calls found — treating as first call for this client');
    Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return null;
  }

  Logger.log('   ✅ Found ' + recentCalls.length + ' previous call(s) to use as context');

  const previousCallSummaries = [];
  const priorReviewerFeedback = [];

  recentCalls.forEach(function(call, index) {
    Logger.log('');
    Logger.log('   ── Call ' + (index + 1) + ' of ' + recentCalls.length + ' ──────────────────────────');
    Logger.log('   Date:       ' + call.callDateText);
    Logger.log('   Meeting ID: ' + (call.meetingId || 'unknown'));
    Logger.log('   Doc ID:     ' + (call.docId ? call.docId.substring(0, 20) + '...' : 'NONE — cannot read doc'));
    Logger.log('   Sheet summary stored: ' + (call.summary ? call.summary.length + ' chars' : 'EMPTY'));

    let summaryText   = '';
    let reviewerText  = '';

    // ── Try to read SUMMARY FOR FUTURE CONTEXT from the coaching doc ──
    if (call.docId) {
      Logger.log('   Opening coaching doc to read sections...');
      try {
        summaryText  = extractNamedSectionFromDoc(call.docId, 'SUMMARY FOR FUTURE CONTEXT');
        reviewerText = extractNamedSectionFromDoc(call.docId, 'PM / AD FEEDBACK FOR MODEL IMPROVEMENT');

        if (summaryText && summaryText.trim().length > 10) {
          Logger.log('   ✅ SUMMARY FOR FUTURE CONTEXT: ' + summaryText.trim().length + ' chars read from doc');
          Logger.log('      Preview: ' + summaryText.trim().substring(0, 120) + (summaryText.length > 120 ? '...' : ''));
        } else {
          Logger.log('   ⚠️  SUMMARY FOR FUTURE CONTEXT: empty or missing in doc — will fall back to sheet summary');
        }

        if (reviewerText && reviewerText.trim().length > 20) {
          Logger.log('   ✅ PM/AD REVIEWER FEEDBACK: ' + reviewerText.trim().length + ' chars read from doc');
        } else {
          Logger.log('   ℹ️  PM/AD REVIEWER FEEDBACK: empty (no feedback submitted yet)');
        }
      } catch (e) {
        Logger.log('   ❌ Could not open coaching doc: ' + e.toString().substring(0, 100));
      }
    } else {
      Logger.log('   ⚠️  No doc URL stored for this call — cannot read doc sections');
    }

    // ── Fall back to sheet-stored summary if doc section was empty ────
    if (!summaryText && call.summary) {
      summaryText = call.summary;
      Logger.log('   ℹ️  Using sheet-stored summary as fallback (' + summaryText.length + ' chars)');
    }

    if (summaryText) {
      previousCallSummaries.push(
        'Call #' + (index + 1) + ' (' + call.callDateText + ')\n' +
        'Meeting: ' + call.meetingTopic + '\n' +
        summaryText
      );
    } else {
      Logger.log('   ⚠️  No summary available for this call — skipping from context');
    }

    if (reviewerText) {
      priorReviewerFeedback.push(
        'Call (' + call.callDateText + ')\n' +
        reviewerText
      );
    }
  });

  const sections = [];

  if (previousCallSummaries.length) {
    sections.push(
      'PREVIOUS CALL CONTEXT FOR ' + clientName.toUpperCase() + ':\n\n' +
      previousCallSummaries.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n')
    );
  }

  if (priorReviewerFeedback.length) {
    sections.push(
      'CLIENT-SPECIFIC PM / AD FEEDBACK FROM PRIOR CALLS:\n\n' +
      priorReviewerFeedback.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n')
    );
  }

  const bundle = sections.length
    ? sections.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n')
    : null;

  Logger.log('');
  if (bundle) {
    Logger.log('   ✅ CONTEXT BUNDLE READY');
    Logger.log('      Total size:            ' + bundle.length + ' chars');
    Logger.log('      Call summaries:        ' + previousCallSummaries.length);
    Logger.log('      Reviewer feedback:     ' + priorReviewerFeedback.length);
    Logger.log('      Will be fed to AI:     YES');
  } else {
    Logger.log('   ⚠️  CONTEXT BUNDLE IS EMPTY — AI will receive no historical context');
    Logger.log('      This is normal for first-ever call with this client');
  }
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return bundle;
}

/**
 * Get recent calls for a client from the Transcripts sheet
 *
 * CHANGED: added detailed terminal logging throughout
 */
function getRecentClientCallRows(clientName, excludeMeetingId) {
  const normalizedClient = String(clientName || '').trim().toLowerCase();
  if (!normalizedClient) return [];

  const sheet   = getTranscriptSheet();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    Logger.log('   ℹ️  Transcript sheet has no data rows yet');
    return [];
  }

  const totalRows = lastRow - 1;
  Logger.log('   Scanning ' + totalRows + ' row(s) in transcript sheet for client: "' + normalizedClient + '"');

  // Pre-compute canonical key for the current client name
  const currentCanonical = getCanonicalClientKey(normalizedClient);
  Logger.log('   Canonical key for current client: "' + currentCanonical + '"');

  const rows    = [];
  let   checked = 0;
  let   matched = 0;
  let   skipped = 0;

  for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
    const row = sheet.getRange(rowNum, 1, 1, 10).getValues()[0];

    const rowTimestamp   = row[0];
    const rowClientName  = String(row[1] || '').trim();
    const rowMeetingId   = String(row[2] || '').trim();
    const rowSummary     = String(row[5] || '').trim();
    const rowMeetingType = String(row[6] || '').trim();

    checked++;

    // Skip blank rows
    if (!rowClientName) continue;

    // ── Client matching — four strategies in priority order ────────────
    // 1. Canonical CLIENT_TEAM_MAP key match (handles AFC = American Family Care)
    // 2. Exact lowercase match
    // 3. Substring match either direction
    const rowCanonical = getCanonicalClientKey(rowClientName.toLowerCase());

    const clientMatch =
      (currentCanonical && rowCanonical && currentCanonical === rowCanonical) ||
      rowClientName.toLowerCase() === normalizedClient ||
      rowClientName.toLowerCase().includes(normalizedClient) ||
      normalizedClient.includes(rowClientName.toLowerCase());

    if (!clientMatch) continue;

    // Skip the current meeting being processed
    if (excludeMeetingId && rowMeetingId === String(excludeMeetingId)) {
      Logger.log('   ↩️  Skipping row ' + rowNum + ' — same meeting ID as current call');
      skipped++;
      continue;
    }

    // Extract doc URL from HYPERLINK formula or plain value
    const rowMeetingDocFormula = sheet.getRange(rowNum, 9).getFormula();
    const rowMeetingDocDisplay = sheet.getRange(rowNum, 9).getDisplayValue();
    const docUrl = extractDocUrlFromSheetCell(rowMeetingDocFormula, rowMeetingDocDisplay);
    const docId  = extractGoogleDocId(docUrl);

    matched++;

    rows.push({
      rowNum:       rowNum,
      timestamp:    rowTimestamp ? new Date(rowTimestamp) : new Date(0),
      callDateText: rowTimestamp
        ? Utilities.formatDate(new Date(rowTimestamp), Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : 'Unknown date',
      clientName:   rowClientName,
      meetingId:    rowMeetingId,
      summary:      rowSummary,
      meetingType:  rowMeetingType,
      docUrl:       docUrl,
      docId:        docId,
      meetingTopic: rowClientName
    });
  }

  Logger.log('   Checked: ' + checked + ' | Matched: ' + matched + ' | Skipped (current): ' + skipped);

  if (!rows.length) {
    Logger.log('   ℹ️  No matching rows found for "' + normalizedClient + '" (canonical: "' + currentCanonical + '")');
    return [];
  }

  // Sort newest first, take up to CONFIG.MAX_PREVIOUS_CALLS
  rows.sort(function(a, b) {
    return b.timestamp.getTime() - a.timestamp.getTime();
  });

  const maxCalls = CONFIG.MAX_PREVIOUS_CALLS || 5;
  const recent   = rows.slice(0, maxCalls);

  Logger.log('   Using ' + recent.length + ' most recent call(s) (max allowed: ' + maxCalls + ')');
  recent.forEach(function(r, i) {
    Logger.log('     ' + (i + 1) + '. ' + r.callDateText +
               ' | ID: ' + r.meetingId +
               ' | DocId: ' + (r.docId ? '✅' : '❌ missing') +
               ' | Summary: ' + (r.summary ? r.summary.length + ' chars' : 'empty'));
  });

  return recent;
}

/**
 * Pull the doc URL from a HYPERLINK formula or a plain cell value
 */
function extractDocUrlFromSheetCell(formula, displayValue) {
  if (formula) {
    const formulaMatch = formula.match(/HYPERLINK\("([^"]+)"/i);
    if (formulaMatch) {
      return formulaMatch[1];
    }
  }

  if (displayValue && /^https?:\/\//i.test(displayValue)) {
    return displayValue;
  }

  return '';
}

/**
 * Extract Google Doc ID from URL or bare ID
 */
function extractGoogleDocId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // Standard Google Docs URL
  const urlMatch = raw.match(/docs\.google\.com\/document\/d\/([^/]+)/i);
  if (urlMatch) return urlMatch[1];

  // Google open URL format: https://docs.google.com/open?id=...
  const openMatch = raw.match(/[?&]id=([A-Za-z0-9_-]{20,})/i);
  if (openMatch) return openMatch[1];

  // Bare ID
  if (/^[A-Za-z0-9_-]{20,}$/.test(raw)) return raw;

  return '';
}

/**
 * Read a named section from a Google Doc body
 */
function extractNamedSectionFromDoc(docId, sectionName) {
  if (!docId) return '';

  try {
    const doc  = DocumentApp.openById(docId);
    const text = doc.getBody().getText();
    return extractNamedSection(text, sectionName);
  } catch (error) {
    Logger.log('Could not read section "' + sectionName + '" from doc ' + docId + ': ' + error);
    return '';
  }
}

/**
 * Extract text between named section headings
 */
function extractNamedSection(text, sectionName) {
  const lines  = String(text || '').split(/\r?\n/);
  const target = normalizeSectionHeading(sectionName);

  let started   = false;
  const collected = [];

  for (let i = 0; i < lines.length; i++) {
    const normalizedLine = normalizeSectionHeading(lines[i]);

    if (!started) {
      if (normalizedLine === target) {
        started = true;
      }
      continue;
    }

    if (
      normalizedLine &&
      normalizedLine !== target &&
      DOC_SECTION_MARKERS.some(marker => normalizeSectionHeading(marker) === normalizedLine)
    ) {
      break;
    }

    collected.push(lines[i]);
  }

  return collected.join('\n').trim();
}

/**
 * Normalize section headings for matching
 */
function normalizeSectionHeading(line) {
  return String(line || '')
    .toUpperCase()
    .replace(/^[^A-Z0-9]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the first transcript timestamp where an external/client participant speaks
 */
function findFirstClientJoinTimestamp(transcript, externalParticipants) {
  if (!transcript || !externalParticipants || !externalParticipants.length) {
    return null;
  }

  const externalNames = externalParticipants
    .map(function(p) { return normalizeParticipantName(p.name); })
    .filter(Boolean);

  if (!externalNames.length) return null;

  const lines = String(transcript).split('\n');

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\[(\d{2}:\d{2}:\d{2})\]\s+([^:]+):/);
    if (!match) continue;

    const ts      = match[1];
    const speaker = normalizeParticipantName(match[2]);

    const isClientSpeaker = externalNames.some(function(name) {
      return speaker === name ||
             speaker.indexOf(name) !== -1 ||
             name.indexOf(speaker) !== -1;
    });

    if (isClientSpeaker) return ts;
  }

  return null;
}

/**
 * Trim transcript so analysis starts from first client join
 */
function trimTranscriptToFirstClientJoin(transcript, externalParticipants) {
  const firstClientTimestamp = findFirstClientJoinTimestamp(transcript, externalParticipants);
  if (!firstClientTimestamp) return transcript;

  const lines   = String(transcript).split('\n');
  let   started = false;
  const kept    = [];

  lines.forEach(function(line) {
    if (!started && line.indexOf('[' + firstClientTimestamp + ']') === 0) {
      started = true;
    }
    if (started) kept.push(line);
  });

  return kept.length ? kept.join('\n') : transcript;
}

/**
 * Add analysis-window instruction to participant context
 */
function appendAnalysisWindowContext(participantContext, clientJoinTimestamp) {
  const base = participantContext || '';
  if (!clientJoinTimestamp) return base;

  return (
    base +
    '\n\n**ANALYSIS WINDOW NOTE:**\n' +
    'For coaching, start substantive analysis from [' + clientJoinTimestamp + '], ' +
    'which is the first point at which a client participant joined the call. ' +
    'Ignore earlier internal chatter unless it created visible waiting or friction ' +
    'for the client after the client had already joined.\n'
  );
}

/**
 * Extract the Summary for Future Context section from current feedback
 */
function extractFutureContextSummaryFromFeedback(feedback) {
  const lines     = String(feedback || '').split('\n');
  let   started   = false;
  const collected = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!started) {
      if (/SUMMARY FOR FUTURE CONTEXT/i.test(line)) {
        started = true;
      }
      continue;
    }

    if (/^\d+\./.test(line) && !/SUMMARY FOR FUTURE CONTEXT/i.test(line)) {
      break;
    }

    collected.push(lines[i]);
  }

  return collected.join('\n').trim();
}

// ─────────────────────────────────────────────────────────────
//  CALIBRATION CONTEXT READER
//  Reads all docs listed in COACHING_FEEDBACK_DOC_IDS.
//  Called once by analyzeCallWithContext() and passed to both providers.
// ─────────────────────────────────────────────────────────────
function getReviewerFeedbackContext() {
  const scriptProps = PropertiesService.getScriptProperties();
  const rawDocIds   = scriptProps.getProperty('COACHING_FEEDBACK_DOC_IDS');

  if (!rawDocIds) return '';

  const docIds = rawDocIds
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  if (!docIds.length) return '';

  const chunks = [];

  docIds.forEach(function(docId) {
    try {
      const doc  = DocumentApp.openById(docId);
      const text = doc.getBody().getText().trim();
      if (text) {
        chunks.push(text.substring(0, CONFIG.MAX_REVIEWER_FEEDBACK_CHARS_PER_DOC));
      }
    } catch (error) {
      Logger.log('Could not read reviewer feedback doc ' + docId + ': ' + error);
    }
  });

  return chunks
    .join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n')
    .substring(0, CONFIG.MAX_REVIEWER_FEEDBACK_TOTAL_CHARS);
}