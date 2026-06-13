// ─── IELTS Write Pro — AI Analysis Module ─────────────────────────────────
// Uses Anthropic Messages API via browser (anthropic-dangerous-allow-browser header)

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANALYSIS_MODEL = 'claude-haiku-4-5-20251001';

// ─── System prompt for full analysis ──────────────────────────────────────

const FULL_ANALYSIS_SYSTEM = `You are an expert IELTS examiner with 15+ years of experience assessing Academic Writing tasks. Your role is to provide precise, actionable feedback following official IELTS marking criteria.

IELTS WRITING BAND DESCRIPTORS (score 1–9 in 0.5 increments):

1. TASK ACHIEVEMENT (Task 1) / TASK RESPONSE (Task 2):
   - Does the response fully address all aspects of the task?
   - Task 1: Are key trends, comparisons and significant data accurately reported? Is there an overview?
   - Task 2: Is a clear position presented? Are ideas well-developed with relevant examples?
   - Band 7+: Covers all requirements with well-developed ideas; Band 5–6: Partially addresses task; Band 4 or below: Fails to address key aspects

2. COHERENCE & COHESION:
   - Overall logical organisation of ideas and paragraphing
   - Effective use of cohesive devices (discourse markers, pronouns, substitution)
   - Band 7+: Logical progression, varied cohesive devices used accurately; Band 5–6: Adequate organisation but may be mechanical; Band 4: Basic/faulty cohesion

3. LEXICAL RESOURCE:
   - Range and accuracy of vocabulary
   - Collocations, idiomatic expressions, topic-specific vocabulary
   - Spelling and word formation errors
   - Band 7+: Sophisticated vocabulary, rare errors; Band 5–6: Adequate range with some errors; Band 4: Limited vocabulary, frequent errors

4. GRAMMATICAL RANGE AND ACCURACY:
   - Variety of sentence structures (simple, compound, complex)
   - Accuracy of grammar including tense, articles, prepositions, subject-verb agreement
   - Band 7+: Wide range, majority error-free; Band 5–6: Mix of simple and complex, some errors; Band 4: Frequent errors

SCORING: All four criteria are weighted equally. Scores are given in 0.5 increments from 1.0 to 9.0. The overall band is the average of all four scores, rounded to the nearest 0.5.

HIGHLIGHT TYPES:
- "good": Excellent phrase, strong vocabulary, effective structure, well-expressed idea
- "improve": Adequate but could be stronger — suggest a better alternative
- "weak": Clear error or significant weakness — grammar mistake, wrong word, unclear expression

You MUST return ONLY valid JSON — no markdown, no explanation outside the JSON object. If the essay is too short or incoherent, still return valid JSON with low scores.

Return this exact JSON structure:
{
  "overall_band": <number 1.0-9.0 in 0.5 steps>,
  "scores": {
    "task_achievement": <number>,
    "coherence_cohesion": <number>,
    "lexical_resource": <number>,
    "grammatical_range": <number>
  },
  "feedback": {
    "task_achievement": "<2-4 sentences of specific, actionable feedback>",
    "coherence_cohesion": "<2-4 sentences of specific, actionable feedback>",
    "lexical_resource": "<2-4 sentences of specific, actionable feedback>",
    "grammatical_range": "<2-4 sentences of specific, actionable feedback>"
  },
  "highlights": [
    {
      "phrase": "<exact phrase from essay, max 10 words>",
      "type": "good|improve|weak",
      "comment": "<brief 1-sentence comment explaining why>"
    }
  ],
  "summary": "<2-3 sentence overall summary mentioning the band score, main strength, and most important improvement area>"
}

Include 6–10 highlights. Cover a mix of all three types. Phrases must be EXACT substrings from the essay (case-sensitive). Prefer shorter, unique phrases to avoid overlap issues.`;

// ─── System prompt for quick check ────────────────────────────────────────

const QUICK_CHECK_SYSTEM = `You are an expert IELTS examiner. Provide a rapid estimated band score assessment for a partially complete IELTS Writing response.

Score all four criteria on a 1–9 scale (0.5 increments) based on what you can assess so far. Be fair — a response may be incomplete.

Return ONLY valid JSON in this exact structure, no other text:
{
  "overall": <number>,
  "ta": <number>,
  "cc": <number>,
  "lr": <number>,
  "gr": <number>
}`;

// ─── Full Essay Analysis ───────────────────────────────────────────────────

async function analyzeEssay({ apiKey, taskType, taskPrompt, essayText, wordCount }) {
  const taskLabel = taskType === '1' ? 'Task 1 (Describe a Chart/Diagram)' : 'Task 2 (Discursive Essay)';
  const minWords = taskType === '1' ? 150 : 250;

  const userMessage = `Please analyse this IELTS Academic Writing ${taskLabel} response.

TASK PROMPT:
${taskPrompt}

CANDIDATE'S RESPONSE (${wordCount} words, minimum required: ${minWords}):
${essayText}

Provide a detailed examiner assessment following the JSON format specified. Be specific about what the candidate does well and what they need to improve. Reference actual phrases from their writing.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-allow-browser': 'true',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      max_tokens: 2000,
      system: FULL_ANALYSIS_SYSTEM,
      messages: [
        { role: 'user', content: userMessage }
      ]
    })
  });

  if (!response.ok) {
    let errMsg = `API error ${response.status}`;
    try {
      const errData = await response.json();
      if (errData.error && errData.error.message) {
        errMsg = errData.error.message;
      }
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  const rawText = data.content && data.content[0] && data.content[0].text;

  if (!rawText) {
    throw new Error('No response content received from the API.');
  }

  // Strip any accidental markdown code fences
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Could not parse examiner response. Please try again. (JSON parse error)');
  }

  // Validate required fields
  if (
    typeof parsed.overall_band !== 'number' ||
    !parsed.scores ||
    !parsed.feedback ||
    !Array.isArray(parsed.highlights) ||
    typeof parsed.summary !== 'string'
  ) {
    throw new Error('Examiner response was incomplete. Please try again.');
  }

  return parsed;
}

// ─── Quick Check (mid-writing estimate) ───────────────────────────────────

async function quickCheckEssay({ apiKey, taskType, essayText, wordCount }) {
  const taskLabel = taskType === '1' ? 'Task 1 (Chart Description)' : 'Task 2 (Essay)';

  const userMessage = `Quick check this partial IELTS ${taskLabel} response (${wordCount} words so far):

${essayText}

Give rapid estimated band scores. Remember this may be incomplete.`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-allow-browser': 'true',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      max_tokens: 200,
      system: QUICK_CHECK_SYSTEM,
      messages: [
        { role: 'user', content: userMessage }
      ]
    })
  });

  if (!response.ok) {
    let errMsg = `API error ${response.status}`;
    try {
      const errData = await response.json();
      if (errData.error && errData.error.message) {
        errMsg = errData.error.message;
      }
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  const rawText = data.content && data.content[0] && data.content[0].text;

  if (!rawText) {
    throw new Error('No response from quick check.');
  }

  const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Could not parse quick check response. Please try again.');
  }

  return parsed;
}
