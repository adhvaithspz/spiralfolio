// ═══════════════════════════════════════════════════════════
//  CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════════

/**
 * List of all Account Directors (ADs)
 */
const AD_EMAILS = [
  'lazarb@spiralyze.com',
  'farouk@spiralyze.com',
  'daria@spiralyze.com',
  'abdelrahman@spiralyze.com',
  'thomas@spiralyze.com',
  'harry@spiralyze.com',
];

/**
 * List of all Project Managers (PMs)
 */
const PM_EMAILS = [
  'ray@spiralyze.com',
  'arbab@spiralyze.com',
  'furqaan@spiralyze.com',
  'nikitad@spiralyze.com',
  'helenr@spiralyze.com',
  'sanan@spiralyze.com',
  'jack@spiralyze.com',
  'eric@spiralyze.com',
  'josh@spiralyze.com',
  'jessica@spiralyze.com',
  'joao@spiralyze.com',
  'rafay@spiralyze.com',
  'bilal@spiralyze.com',
  'tatiana@spiralyze.com',
  'beth@spiralyze.com',
  'sebastian@spiralyze.com',
  'rebekah@spiralyze.com',
];

/**
 * Combined list of all PMs and ADs
 */
const PM_AD_EMAILS = [...PM_EMAILS, ...AD_EMAILS];

/**
 * Configuration constants
 */
const CONFIG = {
  AI_PROVIDER: 'openai',
  OPENAI_MODEL: 'gpt-4.1-mini',
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 4096,
  MAX_PREVIOUS_CALLS: 3,
  MAX_REVIEWER_FEEDBACK_CHARS_PER_DOC: 6000,
  MAX_REVIEWER_FEEDBACK_TOTAL_CHARS: 12000,
  ENABLE_SLACK_POSTING: false,
  SLACK_MESSAGE_CHAR_LIMIT: 3000,

  // Google Sheets
  OUTPUT_SHEET_NAME: 'Processing Log',
  TRANSCRIPT_SHEET_NAME: 'Transcripts',
  SPREADSHEET_NAME: 'Spiralyze Client Call Coaching - Logs',

  // Meeting title patterns for client extraction
  CLIENT_PATTERNS: [
    /Client[:\s-]+(.+?)(?:\s*[-|]|\s*$)/i,
    /^(.+?)\s*[-|]\s*(Kickoff|Meeting|Call|Project|Demo)/i,
    /\[(.+?)\]/,
  ],
};

/**
 * Get role for an email address
 */
function getUserRole(email) {
  const lowerEmail = email.toLowerCase();

  if (PM_EMAILS.some(pm => pm.toLowerCase() === lowerEmail)) {
    return 'PM';
  }

  if (AD_EMAILS.some(ad => ad.toLowerCase() === lowerEmail)) {
    return 'AD';
  }

  return 'Unknown';
}

/**
 * Get or create the main spreadsheet for logging
 */
function getOrCreateSpreadsheet() {
  const scriptProps = PropertiesService.getScriptProperties();
  let spreadsheetId = scriptProps.getProperty('OUTPUT_SPREADSHEET_ID');

  if (spreadsheetId) {
    try {
      const ss = SpreadsheetApp.openById(spreadsheetId);
      ss.getName();
      return ss;
    } catch (error) {
      spreadsheetId = null;
    }
  }

  const ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
  spreadsheetId = ss.getId();
  scriptProps.setProperty('OUTPUT_SPREADSHEET_ID', spreadsheetId);
  return ss;
}

/**
 * Get or create output Google Sheet
 */
function getOutputSheet() {
  const ss = getOrCreateSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.OUTPUT_SHEET_NAME);

  if (!sheet) {
    const defaultSheet = ss.getSheets()[0];
    if (defaultSheet && defaultSheet.getName() === 'Sheet1') {
      sheet = defaultSheet.setName(CONFIG.OUTPUT_SHEET_NAME);
    } else {
      sheet = ss.insertSheet(CONFIG.OUTPUT_SHEET_NAME);
    }

    sheet
      .getRange(1, 1, 1, 10)
      .setValues([
        [
          'Timestamp',
          'Meeting Topic',
          'Client Name',
          'Host Email',
          'Host Name',
          'Role (PM/AD)',
          'Status',
          'Transcript Length',
          'Feedback Generated',
          'Error Message',
        ],
      ]);

    const headerRange = sheet.getRange(1, 1, 1, 10);
    headerRange.setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff').setHorizontalAlignment('center');

    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 250);
    sheet.setColumnWidth(3, 150);
    sheet.setColumnWidth(4, 200);
    sheet.setColumnWidth(5, 150);
    sheet.setColumnWidth(6, 80);
    sheet.setColumnWidth(7, 100);
    sheet.setColumnWidth(8, 120);
    sheet.setColumnWidth(9, 120);
    sheet.setColumnWidth(10, 300);

    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Get or create transcript storage sheet
 */
function getTranscriptSheet() {
  const ss = getOrCreateSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.TRANSCRIPT_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.TRANSCRIPT_SHEET_NAME);

    sheet.getRange(1, 1, 1, 10).setValues([
      [
        'Timestamp', // col 1
        'Client Name', // col 2
        'Meeting ID', // col 3
        'PM Name', // col 4
        'AD Name', // col 5
        'Summary', // col 6
        'Meeting Type', // col 7
        'External Participants', // col 8
        'Coaching Doc', // col 9
        'AI Provider', // col 10
      ],
    ]);

    const headerRange = sheet.getRange(1, 1, 1, 10);
    headerRange.setFontWeight('bold').setBackground('#34a853').setFontColor('#ffffff').setHorizontalAlignment('center');

    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(3, 150);
    sheet.setColumnWidth(4, 150);
    sheet.setColumnWidth(5, 150);
    sheet.setColumnWidth(6, 280);
    sheet.setColumnWidth(7, 100);
    sheet.setColumnWidth(8, 300);
    sheet.setColumnWidth(9, 200);
    sheet.setColumnWidth(10, 120);

    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Log to output sheet
 */
function logToSheet(data) {
  if (data.meetingTopic && data.meetingTopic.includes('Webhook Validation')) {
    Logger.log('Validation logged: ' + JSON.stringify(data));
    return;
  }

  try {
    const sheet = getOutputSheet();

    // 10 values — matches getOutputSheet() header exactly
    const row = [
      new Date(), // col 1  Timestamp
      data.meetingTopic || '', // col 2  Meeting Topic
      data.clientName || '', // col 3  Client Name
      data.hostEmail || '', // col 4  Host Email
      data.hostName || '', // col 5  Host Name
      data.role || '', // col 6  Role (PM/AD)
      data.status || '', // col 7  Status
      data.transcriptLength || 0, // col 8  Transcript Length
      data.feedbackGenerated ? 'Yes' : 'No', // col 9  Feedback Generated
      data.error || '', // col 10 Error Message
    ];

    sheet.appendRow(row);

    const lastRow = sheet.getLastRow();
    const maxCols = sheet.getMaxColumns();

    // Guard: only colour if the sheet actually has 10 columns
    // Prevents "coordinates outside dimensions" when sheet is narrower
    if (lastRow > 0 && maxCols >= 10) {
      const rowRange = sheet.getRange(lastRow, 1, 1, 10);

      switch (data.status) {
        case 'SUCCESS':
        case 'TEST COMPLETE':
          rowRange.setBackground('#d9ead3');
          break;
        case 'ERROR':
        case 'FAILED':
        case 'TEST FAILED':
          rowRange.setBackground('#f4cccc');
          break;
        case 'WARNING':
          rowRange.setBackground('#fff2cc');
          break;
        case 'SKIPPED':
          rowRange.setBackground('#efefef');
          break;
        case 'STARTED':
          rowRange.setBackground('#cfe2f3');
          break;
        default:
          // INFO, TEST, etc — no background
          break;
      }
    }
  } catch (error) {
    Logger.log('logToSheet error: ' + error);
  }
}

function getSpreadsheetUrl() {
  const ss = getOrCreateSpreadsheet();
  return ss.getUrl();
}

function initializeSheets() {
  Logger.log('🔧 Initializing spreadsheet and sheets...\n');

  getOutputSheet();
  getTranscriptSheet();
  const url = getSpreadsheetUrl();

  Logger.log('═══════════════════════════════════════════════════');
  Logger.log('✅ INITIALIZATION COMPLETE');
  Logger.log('═══════════════════════════════════════════════════');
  Logger.log('\n📊 Spreadsheet URL:');
  Logger.log(url);
  Logger.log('\n📋 Sheets created:');
  Logger.log(`  • ${CONFIG.OUTPUT_SHEET_NAME}`);
  Logger.log(`  • ${CONFIG.TRANSCRIPT_SHEET_NAME}`);
  Logger.log('\n💡 The spreadsheet ID has been saved in Script Properties.');
  Logger.log('   All future logs will go to this spreadsheet.\n');
  Logger.log('═══════════════════════════════════════════════════');

  logToSheet({
    status: 'INFO',
    meetingTopic: 'System Initialized',
    error: 'Spiralyze Client Call Coaching system ready',
  });

  return url;
}
