// ═══════════════════════════════════════════════════════════════
//  OPENAI API
// ═══════════════════════════════════════════════════════════════

function analyzeCallWithOpenAI(transcript, clientName, pmName, adName,
                                previousContext, participantContext,
                                callType, reviewerFeedbackContext,
                                additionalInternalNames) {

  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY not set in Script Properties');

  const prompt = buildCoachingPrompt(
    transcript, clientName, pmName, adName,
    previousContext, participantContext,
    reviewerFeedbackContext, callType,
    additionalInternalNames   // ← ADD
  );

  const payload = {
    model: CONFIG.OPENAI_MODEL,
    instructions: 'You are an expert call coach for Spiralyze. Follow all instructions and output format rules exactly as provided in the prompt.',
    input: prompt,
    max_output_tokens: CONFIG.MAX_TOKENS,
    metadata: { app: 'zoom-call-coaching', provider: 'openai', version: 'v2' },
    store: false
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', options);
    const responseCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (responseCode !== 200) {
      Logger.log('OpenAI API error ' + responseCode + ': ' + response.getContentText());
      throw new Error('OpenAI API returned status ' + responseCode);
    }

    const outputText = extractOpenAIText(result);
    if (!outputText) throw new Error('OpenAI response did not include output text');

    Logger.log(`✅ OpenAI analysis complete using ${CONFIG.OPENAI_MODEL}`);
    return outputText;

  } catch (error) {
    Logger.log('Error calling OpenAI API: ' + error);
    throw error;
  }
}

// UNCHANGED
function extractOpenAIText(result) {
  if (result.output_text) return result.output_text;
  if (!result.output || !result.output.length) return '';

  const textParts = [];
  result.output.forEach(function(item) {
    if (!item || !item.content) return;
    item.content.forEach(function(contentPart) {
      if (contentPart.type === 'output_text' && contentPart.text) textParts.push(contentPart.text);
      if (contentPart.type === 'text' && contentPart.text) textParts.push(contentPart.text);
    });
  });
  return textParts.join('\n').trim();
}