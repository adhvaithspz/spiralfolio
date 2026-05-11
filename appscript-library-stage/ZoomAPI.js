// ═══════════════════════════════════════════════════════════
//  ZOOM API FUNCTIONS - MULTI-USER SUPPORT
// ═══════════════════════════════════════════════════════════

/**
 * Get Zoom OAuth access token
 */
/**
 * Get Zoom OAuth access token — cached for 55 minutes.
 * Zoom tokens expire in 60 min. We cache for 55 to stay safe.
 * Uses Apps Script CacheService (in-memory, per-execution) +
 * ScriptProperties (persistent, survives between executions).
 */
function getZoomAccessToken() {
  const CACHE_KEY  = 'ZOOM_ACCESS_TOKEN';
  const EXPIRY_KEY = 'ZOOM_TOKEN_EXPIRY';
  const props      = PropertiesService.getScriptProperties();

  // ── 1. ScriptProperties first — zero network cost, survives executions ──
  // Check this BEFORE CacheService since CacheService.put() costs bandwidth
  const stored = props.getProperty(CACHE_KEY);
  const expiry = props.getProperty(EXPIRY_KEY);

  if (stored && expiry && Date.now() < parseInt(expiry)) {
    Logger.log('✅ Zoom token from ScriptProperties (expires in ' +
      Math.round((parseInt(expiry) - Date.now()) / 60000) + ' min)');
    return stored;
  }

  // ── 2. CacheService fallback (same execution context) ──────────────────
  try {
    const cache  = CacheService.getScriptCache();
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      Logger.log('✅ Zoom token from CacheService');
      return cached;
    }
  } catch (e) {
    Logger.log('CacheService read failed: ' + e);
    // continue to fresh fetch
  }

  // ── 3. Fetch fresh token from Zoom ─────────────────────────────────────
  const accountId    = props.getProperty('ZOOM_ACCOUNT_ID');
  const clientId     = props.getProperty('ZOOM_CLIENT_ID');
  const clientSecret = props.getProperty('ZOOM_CLIENT_SECRET');

  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Missing Zoom credentials in Script Properties');
  }

  const url = 'https://zoom.us/oauth/token?grant_type=account_credentials&account_id=' + accountId;

  try {
    const response = UrlFetchApp.fetch(url, {
      method:  'post',
      headers: {
        'Authorization': 'Basic ' + Utilities.base64Encode(clientId + ':' + clientSecret),
        'Content-Type':  'application/x-www-form-urlencoded'
      },
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());

    if (!result.access_token) {
      throw new Error('Zoom OAuth error: ' + JSON.stringify(result));
    }

    const token      = result.access_token;
    const expiresIn  = result.expires_in || 3600;
    const safeExpiry = Date.now() + (expiresIn - 300) * 1000;

    // ── Store in ScriptProperties — always works, no bandwidth cost ───────
    props.setProperty(CACHE_KEY,  token);
    props.setProperty(EXPIRY_KEY, String(safeExpiry));

    // ── Try to warm CacheService — best-effort, ignore if quota exceeded ──
    try {
      CacheService.getScriptCache().put(CACHE_KEY, token, Math.min(expiresIn - 300, 21600));
    } catch (e) {
      Logger.log('CacheService write skipped (quota): ' + e);
    }

    Logger.log('✅ Fresh Zoom token fetched and cached for ' + Math.round((expiresIn - 300) / 60) + ' min');
    return token;

  } catch (error) {
    throw new Error('Failed to get Zoom token: ' + error);
  }
}

/**
 * Force-clear the cached token — call this if you ever get auth errors
 * and want to force a fresh fetch on the next run.
 */
function clearZoomTokenCache() {
  CacheService.getScriptCache().remove('ZOOM_ACCESS_TOKEN');
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('ZOOM_ACCESS_TOKEN');
  props.deleteProperty('ZOOM_TOKEN_EXPIRY');
  Logger.log('🗑️ Zoom token cache cleared');
}

/**
 * Get all users in Zoom account
 */
function getAllZoomUsers(token) {
  const users = [];
  let pageToken = null;

  do {
    const url = `https://api.zoom.us/v2/users?status=active&page_size=300${pageToken ? '&next_page_token=' + pageToken : ''}`;

    const options = {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const data = JSON.parse(response.getContentText());

      if (data.users) {
        users.push(...data.users);
      }

      pageToken = data.next_page_token;

    } catch (error) {
      Logger.log('Error fetching users: ' + error);
      break;
    }

  } while (pageToken);

  return users;
}

/**
 * Get all PMs and ADs
 */
function getPMsAndADs(token) {
  const allUsers = getAllZoomUsers(token);

  logToSheet({
    status: 'INFO',
    meetingTopic: 'System Check',
    error: `Total Zoom users: ${allUsers.length}`
  });

  const pmsAndADs = allUsers.filter(user =>
    PM_AD_EMAILS.some(email => email.toLowerCase() === user.email.toLowerCase())
  );

  logToSheet({
    status: 'INFO',
    meetingTopic: 'System Check',
    error: `PM/AD users found: ${pmsAndADs.length}/${PM_AD_EMAILS.length}`
  });

  const foundEmails = pmsAndADs.map(u => u.email.toLowerCase());
  const missingEmails = PM_AD_EMAILS.filter(email =>
    !foundEmails.includes(email.toLowerCase())
  );

  if (missingEmails.length > 0) {
    logToSheet({
      status: 'WARNING',
      meetingTopic: 'System Check',
      error: `Missing in Zoom: ${missingEmails.join(', ')}`
    });
  }

  return pmsAndADs;
}

/**
 * Fetch recordings from a specific user
 */
function fetchUserRecordings(userId, token, fromDate, toDate) {
  if (!fromDate) {
    fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
  }
  if (!toDate) {
    toDate = new Date();
  }

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  const url = `https://api.zoom.us/v2/users/${userId}/recordings?from=${fromStr}&to=${toStr}&page_size=300`;

  const options = {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 400) {
      Logger.log(`Invalid request for user ${userId}: 400 Bad Request`);
      return [];
    }

    if (responseCode === 404) {
      Logger.log(`User ${userId} not found or no recordings`);
      return [];
    }

    if (responseCode !== 200) {
      Logger.log(`Error fetching recordings for ${userId}: ${responseCode}`);
      Logger.log(`Error details: ${response.getContentText()}`);
      return [];
    }

    const data = JSON.parse(response.getContentText());
    return data.meetings || [];

  } catch (error) {
    Logger.log(`Exception fetching recordings for user ${userId}: ${error.toString()}`);
    return [];
  }
}

/**
 * Fetch recordings from all PMs and ADs
 */
function fetchAllPMandADRecordings(token, fromDate, toDate) {
  const cache = CacheService.getScriptCache();

  // ── Read from chunked cache (only when no custom date range) ──
  if (!fromDate && !toDate) {
    try {
      const chunkCount = cache.get('ZOOM_RECORDINGS_COUNT');
      if (chunkCount) {
        const count   = parseInt(chunkCount);
        const results = [];
        let   allHit  = true;

        for (let c = 0; c < count; c++) {
          const chunk = cache.get('ZOOM_RECORDINGS_CHUNK_' + c);
          if (!chunk) { allHit = false; break; }
          JSON.parse(chunk).forEach(function(r) { results.push(r); });
        }

        if (allHit && results.length > 0) {
          Logger.log('✅ Recordings from cache (' + results.length + ' recordings across ' + count + ' chunk(s))');
          return results;
        }
      }
    } catch (e) {
      Logger.log('Cache read failed — fetching fresh: ' + e);
    }
  }

  const pmsAndADs     = getPMsAndADs(token);
  const allRecordings = [];

  logToSheet({
    status:       'INFO',
    meetingTopic: 'Batch Fetch Started',
    error:        'Checking ' + pmsAndADs.length + ' PM/AD users'
  });

  pmsAndADs.forEach(function(user, index) {
    // Sleep between users to spread bandwidth and avoid quota bursts
    if (index > 0) Utilities.sleep(500);

    const recordings = fetchUserRecordings(user.id, token, fromDate, toDate);

    if (recordings.length > 0) {
      recordings.forEach(function(recording) {
        recording.host_email = user.email;
        recording.host_name  = (user.first_name + ' ' + user.last_name).trim();
        recording.host_role  = getUserRole(user.email);
      });
      allRecordings.push(...recordings);

      logToSheet({
        status:       'INFO',
        hostEmail:    user.email,
        hostName:     (user.first_name + ' ' + user.last_name).trim(),
        role:         getUserRole(user.email),
        meetingTopic: 'Recordings Found',
        error:        recordings.length + ' recordings'
      });
    }
  });

  logToSheet({
    status:       'SUCCESS',
    meetingTopic: 'Batch Fetch Complete',
    error:        'Total recordings found: ' + allRecordings.length
  });

  // ── Write to chunked cache — 20 recordings per chunk (~60KB each) ──
  // Only cache when not using a custom date range
  if (!fromDate && !toDate && allRecordings.length > 0) {
    try {
      const CHUNK_SIZE = 20;
      const chunkCount = Math.ceil(allRecordings.length / CHUNK_SIZE);

      cache.put('ZOOM_RECORDINGS_COUNT', String(chunkCount), 600);

      for (let c = 0; c < chunkCount; c++) {
        const chunk      = allRecordings.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
        const serialized = JSON.stringify(chunk);
        cache.put('ZOOM_RECORDINGS_CHUNK_' + c, serialized, 600);
      }

      Logger.log('✅ Recordings cached in ' + chunkCount + ' chunk(s) for 10 minutes');
    } catch (e) {
      Logger.log('Could not cache recordings: ' + e);
    }
  }

  return allRecordings;
}

/**
 * Get recording details
 */
function getRecordingDetails(meetingId, token) {
  const url = `https://api.zoom.us/v2/meetings/${meetingId}/recordings`;

  const options = {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      Logger.log(`Error fetching recording ${meetingId}: ${responseCode}`);
      Logger.log(response.getContentText());
      return null;
    }

    return JSON.parse(response.getContentText());

  } catch (error) {
    Logger.log('Error fetching recording: ' + error);
    return null;
  }
}

/**
 * Download transcript
 * FIXED: use Authorization header, not access_token query param
 */
function downloadTranscript(recording, token) {
  const transcriptFile = (recording.recording_files || []).find(
    file => file.file_type === 'TRANSCRIPT' || file.recording_type === 'audio_transcript'
  );

  if (!transcriptFile) {
    logToSheet({
      status: 'ERROR',
      meetingTopic: recording.topic || 'Unknown',
      error: 'No transcript file found'
    });
    return null;
  }

  if (!transcriptFile.download_url) {
    logToSheet({
      status: 'ERROR',
      meetingTopic: recording.topic || 'Unknown',
      error: 'Transcript file has no download_url'
    });
    return null;
  }

  try {
    const transcript = fetchZoomDownloadText(transcriptFile.download_url, token);

    if (!transcript) {
      logToSheet({
        status: 'ERROR',
        meetingTopic: recording.topic || 'Unknown',
        error: 'Transcript download returned empty content'
      });
      return null;
    }

    return parseVTTTranscript(transcript);

  } catch (error) {
    Logger.log('Error downloading transcript: ' + error);

    logToSheet({
      status: 'ERROR',
      meetingTopic: recording.topic || 'Unknown',
      error: 'Transcript download failed: ' + error
    });

    return null;
  }
}

/**
 * Robust download helper for Zoom file URLs
 * Handles redirects explicitly and avoids token-in-query-param usage.
 */
/**
 * Download Zoom transcript content via the Zoom API gateway.
 * Avoids direct ssrweb.zoom.us CDN access which is blocked from Apps Script.
 *
 * Strategy:
 *   1. Try the Zoom API recordings download endpoint (passes through Zoom's gateway)
 *   2. Fall back to direct download_url with token (original method)
 *   3. Fall back to download_url without token (for already-signed URLs)
 */
function fetchZoomDownloadText(downloadUrl, token) {

  // ── Strategy 1: Zoom recording content API (lowest quota cost) ──────────
  // Endpoint: GET /v2/meetings/{meetingId}/recordings/{fileId}/transcript/download
  // This streams through Zoom's API gateway rather than the CDN directly.
  // Extract meetingId and fileId from the download_url if it's an API URL.
  const apiMatch = downloadUrl.match(/\/meetings\/([^/]+)\/recordings\/([^/]+)\/download/);
  if (apiMatch) {
    try {
      const apiUrl = 'https://api.zoom.us/v2/meetings/' + apiMatch[1] +
                     '/recordings/' + apiMatch[2] + '/download';
      const res = UrlFetchApp.fetch(apiUrl, {
        method: 'get',
        headers: { 'Authorization': 'Bearer ' + token },
        muteHttpExceptions: true,
        followRedirects: true
      });
      if (res.getResponseCode() === 200) {
        const text = res.getContentText();
        if (text && text.trim().length > 10) {
          Logger.log('✅ Transcript via Zoom API endpoint');
          return text;
        }
      }
    } catch (e) {
      Logger.log('Strategy 1 failed: ' + e);
    }
  }

  // ── Strategy 2: Direct URL with token, no redirect follow ───────────────
  // Catch the 302 redirect location manually
  try {
    const res = UrlFetchApp.fetch(downloadUrl, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true,
      followRedirects: false
    });
    const code = res.getResponseCode();
    Logger.log('Strategy 2 direct fetch: HTTP ' + code);

    if (code === 200) {
      const text = res.getContentText();
      if (text && text.trim().length > 10) return text;
    }

    if (code === 302 || code === 301) {
      const location = res.getHeaders()['Location'] || res.getHeaders()['location'];
      if (location) {
        Logger.log('Redirect location: ' + location.substring(0, 80) + '...');

        // ── Strategy 3: CDN URL without auth header ────────────────────
        // ssrweb signed URLs are self-authenticating — adding auth can break them
        try {
          const cdnRes = UrlFetchApp.fetch(location, {
            method: 'get',
            muteHttpExceptions: true,
            followRedirects: true
          });
          if (cdnRes.getResponseCode() === 200) {
            const text = cdnRes.getContentText();
            if (text && text.trim().length > 10) {
              Logger.log('✅ Transcript via CDN (no auth)');
              return text;
            }
          }
        } catch (e) {
          Logger.log('Strategy 3 CDN failed: ' + e);
        }

        // ── Strategy 4: CDN URL with auth header ──────────────────────
        try {
          const cdnAuthRes = UrlFetchApp.fetch(location, {
            method: 'get',
            headers: { 'Authorization': 'Bearer ' + token },
            muteHttpExceptions: true,
            followRedirects: true
          });
          if (cdnAuthRes.getResponseCode() === 200) {
            const text = cdnAuthRes.getContentText();
            if (text && text.trim().length > 10) {
              Logger.log('✅ Transcript via CDN (with auth)');
              return text;
            }
          }
        } catch (e) {
          Logger.log('Strategy 4 CDN+auth failed: ' + e);
        }
      }
    }
  } catch (e) {
    Logger.log('Strategy 2 failed: ' + e);
  }

  // ── Strategy 5: followRedirects: true fallback ───────────────────────────
  try {
    const res = UrlFetchApp.fetch(downloadUrl, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true,
      followRedirects: true
    });
    if (res.getResponseCode() === 200) {
      const text = res.getContentText();
      if (text && text.trim().length > 10) {
        Logger.log('✅ Transcript via fallback followRedirects');
        return text;
      }
    }
  } catch (e) {
    Logger.log('Strategy 5 fallback failed: ' + e);
  }

  throw new Error(
    'All transcript download strategies failed. ' +
    'Bandwidth quota exceeded on ssrweb.zoom.us CDN. ' +
    'Wait a few minutes and retry, or use the manual transcript workflow.'
  );
}

function truncateForLog(text) {
  if (!text) return '';
  return text.length > 500 ? text.substring(0, 500) + '...' : text;
}

/**
 * Parse VTT transcript
 */
function parseVTTTranscript(vttContent) {
  const lines = vttContent.split('\n');
  let parsed = '';
  let currentTimestamp = '';
  let speakerName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '' || line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
      continue;
    }

    if (line.includes('-->')) {
      const startTime = line.split('-->')[0].trim();
      currentTimestamp = startTime.substring(0, 8);
      continue;
    }

    if (/^\d+$/.test(line)) {
      continue;
    }

    const speakerMatch = line.match(/<v\s+([^>]+)>(.*)<\/v>/);
    if (speakerMatch) {
      speakerName = speakerMatch[1];
      const text = speakerMatch[2];
      parsed += `[${currentTimestamp}] ${speakerName}: ${text}\n`;
      continue;
    }

    if (line.length > 0 && currentTimestamp) {
      if (speakerName) {
        parsed += `[${currentTimestamp}] ${speakerName}: ${line}\n`;
      } else {
        parsed += `[${currentTimestamp}] ${line}\n`;
      }
    }
  }

  return parsed || vttContent;
}