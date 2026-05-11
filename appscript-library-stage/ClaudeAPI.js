// ═══════════════════════════════════════════════════════════════
//  AI ROUTER + CLAUDE API
// ═══════════════════════════════════════════════════════════════

// ── ROUTER ────────────────────────────────────────────────────
function analyzeCallWithContext(transcript, clientName, pmName, adName,
                                previousContext, participantContext,
                                callType, additionalInternalNames) {

  const provider = getActiveAIProvider();
  const reviewerFeedbackContext = getReviewerFeedbackContext();

  if (provider === 'openai') {
    return analyzeCallWithOpenAI(
      transcript, clientName, pmName, adName,
      previousContext, participantContext,
      callType, reviewerFeedbackContext,
      additionalInternalNames   // ← ADD
    );
  }

  if (provider === 'claude') {
    return analyzeCallWithClaude(
      transcript, clientName, pmName, adName,
      previousContext, participantContext,
      callType, reviewerFeedbackContext,
      additionalInternalNames   // ← ADD
    );
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}


// ── UNCHANGED ─────────────────────────────────────────────────
function getActiveAIProvider() {
  return (CONFIG.AI_PROVIDER || 'openai').toLowerCase();
}

// ── CLAUDE PROVIDER ───────────────────────────────────────────
function analyzeCallWithClaude(transcript, clientName, pmName, adName,
                                previousContext, participantContext,
                                callType, reviewerFeedbackContext,
                                additionalInternalNames) {

  const apiKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!apiKey) throw new Error('CLAUDE_API_KEY not set in Script Properties');

  const prompt = buildCoachingPrompt(
    transcript, clientName, pmName, adName,
    previousContext, participantContext,
    reviewerFeedbackContext, callType,
    additionalInternalNames   // ← ADD
  );

  const payload = {
    model: CONFIG.CLAUDE_MODEL,
    max_tokens: CONFIG.MAX_TOKENS,
    system: 'You are an expert call coach for Spiralyze. Follow all instructions and output format rules exactly as provided in the prompt.',
    messages: [{ role: 'user', content: prompt }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    const responseCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (responseCode !== 200) {
      Logger.log('Claude API error ' + responseCode + ': ' + response.getContentText());
      throw new Error('Claude API returned status ' + responseCode);
    }

    Logger.log(`✅ Claude complete (${result.usage.input_tokens} in / ${result.usage.output_tokens} out)`);
    return result.content[0].text;

  } catch (error) {
    Logger.log('Error calling Claude API: ' + error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
//  buildCoachingPrompt — SINGLE SOURCE OF TRUTH FOR ALL PROMPTS
//  Works for both OpenAI and Claude (both receive this same string)
// ═══════════════════════════════════════════════════════════════
// CHANGED: added `callType` parameter; routes to type-specific output format
function buildCoachingPrompt(transcript, clientName, pmName, adName,
                              previousContext, participantContext,
                              reviewerFeedbackContext, callType,
                              additionalInternalNames) {

  const pmLabel  = pmName  || 'the PM';
  const adLabel  = adName  || 'the AD';
  const resolvedCallType = callType || 'client_weekly';

  // Build a clean, comma-separated string of additional names for the prompt
  const extraNames = (additionalInternalNames || []).filter(Boolean);
  const extraNamesStr = extraNames.length
    ? extraNames.join(', ')
    : null;

  const header = `You are an expert call coach at Spiralyze reviewing a recorded meeting.
Your output must be useful enough to paste directly into Slack for each named attendee.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GLOBAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Do NOT include revenue-opportunity speculation.
- Do NOT comment on informal discussion before the first external party joins, unless it caused visible friction.
- Do NOT use harsh, blaming, or embarrassing language.
- Use constructive phrasing: "You did X well at [HH:MM:SS]. To make it even stronger, [suggestion]."
- Anchor every coaching point to a timestamp wherever possible.
- Do not invent issues not clearly supported by the transcript.
- Good observation first, improvement second — in the same bullet.
- Treat speaker attribution as fallible. If uncertain, use "the team."
- On presentation-heavy calls, higher presenter talk time is normal and should not be flagged.
- Do NOT use language that implies hierarchy or seniority between team members in a negative way.
  Forbidden phrases include: "less experienced", "junior", "more senior", "compared to others on the call",
  "given your seniority", or any framing that could embarrass someone relative to a colleague.
  Instead, phrase suggestions in absolute terms: "to ensure everyone follows along",
  "to help the full group stay aligned", "to keep the whole team anchored".
- Do NOT reference a person's role level (founder, director, senior) as a reason they should do something
  differently. Coach the behaviour, not the title.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CALIBRATION CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${reviewerFeedbackContext || 'None available.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIOR CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${previousContext || 'None — treat as first encounter.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTICIPANT CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${participantContext || 'None provided.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CALL: ${clientName || 'Unknown'}
CALL TYPE: ${resolvedCallType}
PM: ${pmLabel}
AD: ${adLabel}
${extraNamesStr ? `ADDITIONAL SPIRALYZE ATTENDEES: ${extraNamesStr}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRANSCRIPT:
${transcript}

`;

  if (resolvedCallType === 'design_review')
    return header + getDesignReviewOutputFormat(pmLabel, adLabel, extraNames);

  if (resolvedCallType === 'sales_call')
    return header + getSalesCallOutputFormat(extraNames);

  if (resolvedCallType === 'interview')
    return header + getInterviewOutputFormat(extraNames);

  if (resolvedCallType === 'internal')
    return header + getInternalCallOutputFormat(pmLabel, adLabel, extraNames);

  return header + getClientWeeklyOutputFormat(pmLabel, adLabel, extraNames);
}


// ═══════════════════════════════════════════════════════════════
//  OUTPUT FORMAT TEMPLATES — one per call type
// ═══════════════════════════════════════════════════════════════

// ── HELPER: generates individual feedback section for any named person ──
// Used by all format functions to produce Slack-ready per-person blocks
function _individualFeedbackSection(name, role, focusAreas) {

  // Only show role label for PM and AD — all others just show the name
  const LABELED_ROLES = ['PM', 'AD', 'Presenter/PM', 'Reviewer/AD', 'Lead Rep'];
  const showRole = role && LABELED_ROLES.some(r => role.toUpperCase().includes(r.toUpperCase()));
  const heading  = showRole ? `${name} (${role})` : name;

  return `**INDIVIDUAL FEEDBACK — ${heading}**
Write directly TO ${name} in first-person coaching voice ("You…"), not about them.
This section must be self-contained and suitable to paste as a Slack message to ${name} alone.

Every bullet must:
- Start with a specific positive observation tied to a [HH:MM:SS] timestamp.
- Follow immediately in the same bullet with a concrete, actionable improvement suggestion.
- Use a DIFFERENT transition phrase for every bullet. Do not repeat the same phrase twice in this section.

Use this vocabulary of transition phrases — rotate through them naturally:
  • "To take it even further, …"
  • "One thing to consider next time: …"
  • "Where you could push it further: …"
  • "A small addition that would sharpen this: …"
  • "Next time, try …"
  • "To close the loop even more cleanly, …"
  • "The one thing that would make this land harder: …"
  • "Building on that, consider …"
  • "To make the impact stick, …"
  • "What would elevate this further: …"

Do NOT use "To make it even stronger" — vary phrasing so feedback feels tailored, not templated.
Do NOT use language implying hierarchy between team members (e.g. "less experienced", "junior").
Coach the behaviour, not the title or role level.

Focus areas for ${name}: ${focusAreas}
Only include points clearly attributable to ${name} based on transcript evidence.
Minimum 2 bullets, maximum 5.
If attribution is unclear, write: "No individual coaching for ${name} this call — transcript attribution was not clear enough."

`;
}

// ── CLIENT WEEKLY ────────────────────────────────────────────────
function getClientWeeklyOutputFormat(pmLabel, adLabel, extraNames) {
  let extraSections = '';
  (extraNames || []).forEach(function(name) {
    extraSections += _individualFeedbackSection(
      name, 'Spiralyze',
      'overall contribution quality, question quality, moments where they added or could have added value'
    );
  });

  return `OUTPUT FORMAT — CLIENT WEEKLY / CRO CALL

**1. EXECUTIVE SUMMARY**
2–4 bullets. What happened, tone, key themes. No timestamps needed.

**2. TOP COACHING MOMENTS**
3–5 bullets with [HH:MM:SS] timestamps. Cover both strong moments and moments that could be stronger.

**3. RISKS / RED FLAGS**
Real, grounded risks only. Timestamps required. Do not escalate minor items.

**4. POSITIVE SIGNALS**
What the client or team did well. Timestamps required.

${_individualFeedbackSection(pmLabel, 'PM',
  'meeting structure, agenda control, client question handling, follow-up clarity, action item ownership')}
${_individualFeedbackSection(adLabel, 'AD',
  'design rationale, client feedback handling, creative direction, revision scoping, stakeholder management')}
${extraSections}**7. TEAM-LEVEL FEEDBACK**
Cross-functional coaching only. Timestamps required.

**8. IMMEDIATE NEXT STEPS**
Named owners and timelines visible in the transcript.

**9. COMPACT METRICS**
- Talk ratio (note if presentation-heavy)
- Questions asked by Spiralyze: count + 1–2 example timestamps
- Questions asked by client: count + 1–2 example timestamps
- Pain points identified
- Action items defined: count
- Next-step clarity score: X/10 with one-line rationale

**10. SUMMARY FOR FUTURE CONTEXT**
3–6 bullets: client goals, blockers, key stakeholders, standing decisions, open commitments.
`;
}

// ── DESIGN REVIEW ────────────────────────────────────────────────
function getDesignReviewOutputFormat(pmLabel, adLabel, extraNames) {
  let extraSections = '';
  (extraNames || []).forEach(function(name) {
    extraSections += _individualFeedbackSection(
      name, 'Spiralyze',
      'strategic design input, quality of feedback given, whether they helped move the review forward, clarity of direction provided'
    );
  });

  return `OUTPUT FORMAT — DESIGN REVIEW CALL

**1. REVIEW SUMMARY**
2–3 bullets. What was reviewed, decisions reached, overall tone.

**2. DESIGN FEEDBACK QUALITY**
3–5 bullets with timestamps. Was feedback specific and actionable? Were revisions scoped clearly? Did presenters explain rationale?

**3. ALIGNMENT & DECISION MOMENTS**
What got agreed on, changed, or left unresolved. Timestamps required.

**4. RISKS / OPEN QUESTIONS**
Design or scope risks visible in the transcript. Timestamps where possible.

${_individualFeedbackSection(pmLabel, 'Presenter/PM',
  'clarity of design rationale, handling of feedback received, pacing, revision scoping, how well they explained decisions')}
${_individualFeedbackSection(adLabel, 'Reviewer/AD',
  'quality of feedback given, specificity, whether they helped move the review forward or introduced scope ambiguity')}
${extraSections}**7. IMMEDIATE NEXT STEPS**
Specific revisions, owners, and target delivery dates visible in the transcript.

**8. SUMMARY FOR FUTURE CONTEXT**
3–5 bullets: design direction agreed, open feedback items, next review touchpoint.
`;
}

// ── SALES CALL ───────────────────────────────────────────────────
// No PM/AD concept — all Spiralyze attendees coached individually
function getSalesCallOutputFormat(extraNames) {
  const allAttendees = extraNames || [];

  let individualSections = '';
  if (allAttendees.length === 0) {
    individualSections = `**INDIVIDUAL FEEDBACK**
No named Spiralyze attendees were identified from the transcript.
Provide team-level coaching in Section 6 instead.

`;
  } else {
    allAttendees.forEach(function(name, idx) {
      const isLead = idx === 0; // first person treated as lead rep
      individualSections += _individualFeedbackSection(
        name,
        isLead ? 'Lead Rep' : 'Supporting',
        isLead
          ? 'discovery depth, framing, listening, objection handling, call-to-action clarity, closing moves'
          : 'supporting role quality, when they stepped in, whether their contributions helped or complicated the conversation'
      );
    });
  }

  return `OUTPUT FORMAT — SALES / DISCOVERY CALL

NOTE: Sales calls have no fixed PM/AD roles. All named Spiralyze attendees receive individual coaching.

**1. CALL SUMMARY**
2–3 bullets. Stage of the conversation, what was discussed, prospect engagement level.

**2. TOP SALES MOMENTS**
3–5 bullets with timestamps. Strong moments and moments that could have been stronger.
Focus on: discovery quality, value framing, objection handling, closing moves.

**3. PROSPECT SIGNALS**
Buying signals, objections, hesitations, positive engagement. Timestamps required.

**4. RISKS / RED FLAGS**
Deal health concerns visible in the transcript. Do not speculate beyond what was said.

${individualSections}**6. TEAM-LEVEL FEEDBACK**
Cross-functional coaching. Timestamps required.

**7. IMMEDIATE NEXT STEPS**
Follow-up commitments, send items, next meeting agreed on the call.

**8. DEAL CONTEXT FOR FUTURE REFERENCE**
3–5 bullets: prospect name/role, pain points stated, objections raised, agreed next step.
`;
}

// ── INTERVIEW ────────────────────────────────────────────────────
// Interviewers coached individually. Candidate gets a SEPARATE section.
function getInterviewOutputFormat(extraNames) {
  const interviewers = extraNames || [];

  let interviewerSections = '';
  if (interviewers.length === 0) {
    interviewerSections = `**INTERVIEWER FEEDBACK**
No named interviewers were identified from the transcript with sufficient attribution.
Provide team-level interviewing coaching in Section 7 instead.

`;
  } else {
    interviewers.forEach(function(name) {
      interviewerSections += _individualFeedbackSection(
        name, 'Interviewer',
        'question quality, active listening, fairness, pacing, coverage of key competencies, whether they probed effectively or left gaps'
      );
    });
  }

  return `OUTPUT FORMAT — INTERVIEW / HIRING CALL

NOTE: This is a hiring call. Do not assess the candidate's personal qualities harshly.
Focus on observable behaviour: how they communicated, structured answers, handled unknowns.

**1. INTERVIEW SUMMARY**
2–3 bullets. Role being hired for, candidate overview, how the interview ran overall.

**2. INTERVIEW STRUCTURE & COVERAGE**
3–5 bullets with timestamps. Were key areas covered? Was time managed well?
Were questions open-ended and role-relevant?

**3. CANDIDATE ASSESSMENT**
IMPORTANT: Write this section about the candidate (not to them — this is for internal use).
Cover the following with timestamps where possible:
- Communication clarity and structure
- Relevant experience or knowledge demonstrated
- Handling of difficult or unexpected questions
- Red flags or gaps (stated factually, not harshly)
- Overall impression vs role requirements
This section will be used by the hiring team to inform their decision.

**4. STRONG CANDIDATE MOMENTS**
Timestamps where the candidate demonstrated clarity, relevant experience, or good thinking.

**5. UNCLEAR OR UNPROBED AREAS**
Topics that were raised but not followed up on. Timestamps where possible.
These are suggestions for a follow-up round if needed.

${interviewerSections}**7. TEAM-LEVEL INTERVIEWING FEEDBACK**
Patterns across interviewers — question overlap, coverage gaps, pacing. Timestamps required.

**8. SUGGESTED FOLLOW-UP PROBES**
Topics worth exploring in a next round based on what came up but was not fully covered.

**9. HIRING CONTEXT SUMMARY**
3–5 bullets: role, candidate strengths observed, open questions, recommended next step.
`;
}

// ── INTERNAL ────────────────────────────────────────────────────
function getInternalCallOutputFormat(pmLabel, adLabel, extraNames) {
  const allAttendees = [pmLabel, adLabel, ...(extraNames || [])]
    .filter(n => n && n !== 'the PM' && n !== 'the AD');

  let individualSections = '';
  allAttendees.forEach(function(name) {
    individualSections += _individualFeedbackSection(
      name, 'Spiralyze',
      'clarity of contribution, handling of ambiguity, whether they moved the conversation forward, decision ownership'
    );
  });

  return `OUTPUT FORMAT — INTERNAL TEAM CALL

**1. CALL SUMMARY**
2–3 bullets. Purpose of the meeting, what was covered, key outcomes.

**2. COLLABORATION QUALITY**
3–5 bullets with timestamps. Clear communication? Decisions made? Balanced participation? Blockers surfaced and owned?

**3. KEY DECISIONS & OPEN ITEMS**
What got decided vs what was left unresolved. Timestamps required.

${individualSections}**5. IMMEDIATE NEXT STEPS**
Named owners and timelines visible in the transcript.

**6. CONTEXT FOR FOLLOW-UP**
3–5 bullets: decisions made, blockers, who owns what, next meeting or deadline.
`;
}