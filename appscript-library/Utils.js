// ═══════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Extract client name from meeting title
 * FIXED: handles titles like "SPZ <> Cleerly | Weekly CRO"
 */
function extractClientName(meetingTopic) {
  if (!meetingTopic) return null;

  // Method 1: Special handling for "<>" titles
  // Examples:
  // "Fleetio <> Spiralyze | Weekly Check In" -> Fleetio
  // "SPZ <> Cleerly | Weekly CRO" -> Cleerly
  // "Spiralyze <> Mixpanel" -> Mixpanel
  const arrowMatch = meetingTopic.match(/^(.+?)\s*<>\s*(.+?)(?:\s*\||\s*$)/i);
  if (arrowMatch) {
    const left = cleanClientName(arrowMatch[1]);
    const right = cleanClientName(arrowMatch[2]);

    if (isSpiralyzeAlias(left) && !isSpiralyzeAlias(right)) {
      return right;
    }

    if (isSpiralyzeAlias(right) && !isSpiralyzeAlias(left)) {
      return left;
    }

    // fallback if neither side is a Spiralyze alias
    if (left && !isSpiralyzeAlias(left)) {
      return left;
    }

    if (right && !isSpiralyzeAlias(right)) {
      return right;
    }
  }

  // Method 2: "Client: Acme Corp" or "Client - Acme Corp"
  let match = meetingTopic.match(/Client[:\s-]+(.+?)(?:\s*[-|]|\s*$)/i);
  if (match) return cleanClientName(match[1]);

  // Method 3: "Acme Corp - Kickoff" or "Acme Corp | Project Meeting"
  match = meetingTopic.match(/^(.+?)\s*[-|]\s*(Kickoff|Meeting|Call|Project|Demo|Planning|Check[- ]?In|Sync)/i);
  if (match) return cleanClientName(match[1]);

  // Method 4: "[Acme Corp] Meeting"
  match = meetingTopic.match(/\[(.+?)\]/);
  if (match) return cleanClientName(match[1]);

  // Method 5: generic first-part fallback before pipe
  match = meetingTopic.match(/^([^|]+)/);
  if (match) {
    const extracted = cleanClientName(match[1]);
    if (extracted && !isSpiralyzeAlias(extracted) && extracted.length > 2) {
      return extracted;
    }
  }

  Logger.log(`⚠️ Could not extract client name from: "${meetingTopic}"`);
  return null;
}

/**
 * Clean up extracted client name
 */
function cleanClientName(name) {
  return String(name || '')
    .trim()
    .replace(/^(client|with)\s*/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*<>\s*/g, '')
    .replace(/\s*[|]\s*$/, '')
    .trim();
}

/**
 * Detect Spiralyze aliases in titles
 */
function isSpiralyzeAlias(name) {
  const normalized = String(name || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  return normalized === 'spiralyze' || normalized === 'spz';
}

/**
 * Extract PM name from participants or meeting title
 */
function extractPMName(participants, meetingTopic) {
  const titleMatch = meetingTopic.match(/PM:\s*([A-Za-z\s]+?)(?:\s*[,|]|$)/i);
  if (titleMatch) return titleMatch[1].trim();

  return 'Unknown PM';
}

/**
 * Extract AD name from participants or meeting title
 */
function extractADName(participants, meetingTopic) {
  const titleMatch = meetingTopic.match(/AD:\s*([A-Za-z\s]+?)(?:\s*[,|]|$)/i);
  if (titleMatch) return titleMatch[1].trim();

  return 'Unknown AD';
}

/**
 * Convert client name to Slack channel name
 */
function getSlackChannelName(clientName) {
  if (!clientName) return 'client-unknown';

  return 'client-' + clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Post feedback to client-specific Slack channel
 */
function postToClientSlackChannel(clientName, feedback, meetingTopic, recordingUrl, pmName, adName, externalParticipants, docUrl) {
  const slackToken = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');

  if (!slackToken) {
    Logger.log('⚠️ No SLACK_BOT_TOKEN configured - skipping Slack post');
    Logger.log('Feedback:\n' + feedback);
    return;
  }

  const channelName = getSlackChannelName(clientName);

  let externalText = '';
  if (externalParticipants && externalParticipants.length > 0) {
    const externalNames = externalParticipants
      .map(p => p.name || p.email)
      .filter(n => n)
      .join(', ');
    externalText = ` | *Client attendees:* ${externalNames}`;
  }

  const message = {
    channel: channelName,
    text: `🎯 Coaching Feedback: ${meetingTopic}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🎯 Call Coaching: ${meetingTopic}`,
          emoji: true
        }
      },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: `*Client:* ${clientName} | *PM:* ${pmName} | *AD:* ${adName} | *Date:* ${new Date().toLocaleDateString()}${externalText}`
        }]
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: feedback.substring(0, 2800) + '\n\n_Full feedback in Google Doc_ 👇'
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📄 Full Transcript & Feedback',
              emoji: true
            },
            url: docUrl,
            style: 'primary'
          }
        ]
      }
    ]
  };

  if (recordingUrl) {
    message.blocks[message.blocks.length - 1].elements.push({
      type: 'button',
      text: {
        type: 'plain_text',
        text: '🎥 View Recording',
        emoji: true
      },
      url: recordingUrl
    });
  }

  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${slackToken}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(message),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', options);
    const result = JSON.parse(response.getContentText());

    if (result.ok) {
      Logger.log(`✅ Posted to #${channelName}`);
    } else {
      Logger.log(`⚠️ Slack error: ${result.error}`);

      if (result.error === 'channel_not_found') {
        Logger.log(`💡 Create channel: #${channelName}`);
      }
    }

  } catch (error) {
    Logger.log('⚠️ Error posting to Slack: ' + error);
  }
}