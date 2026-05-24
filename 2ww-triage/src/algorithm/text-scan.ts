/**
 * Free-text intelligence layer for the algorithm.
 *
 * The Trust algorithm is deterministic on structured fields, but clinic
 * letters carry critical information in free text: "DRE: haemorrhoids",
 * "previous subtotal colectomy", "permanent end colostomy", etc. If the
 * FY1 transcribes those into PMH/exam-findings/surgical-history but
 * doesn't tick the matching structured field, the engine would have
 * recommended an investigation that doesn't fit the patient.
 *
 * This scanner runs regex over the free-text fields and surfaces
 * warnings whenever it detects a clinically material phrase. It does
 * NOT change the leaf — clinical judgement / structured fields stay
 * the source of truth — but it gives the FY1 a clear "you might have
 * missed this" prompt.
 *
 * Patterns are intentionally conservative (high precision, low recall)
 * so the FY1 isn't drowned in false positives.
 */

export interface TextScanHit {
  /** Category — used to deduplicate against structured-field signals. */
  category:
    | 'bowel_surgery_anatomy_change'
    | 'stoma'
    | 'visible_bleed_source'
    | 'anticoagulant'
    | 'recent_imaging'
    | 'palliative_or_advanced_disease'
  /** Phrase matched, lowercased. */
  match: string
  /** Which free-text field it came from. */
  source: string
  /** Plain-English message for the warnings list. */
  message: string
}

const BOWEL_SURGERY_ANATOMY = [
  /\bsubtotal\s+colectom/i,
  /\btotal\s+colectom/i,
  /\b(extended|right|left)\s+hemicolectom/i,
  /\bproctocolectom/i,
  /\bAPR\b/,
  /\babdomino-?perineal\s+resect/i,
  /\b(low\s+)?anterior\s+resect/i,
  /\bilea?l\s+pouch/i,
  /\bIPAA\b/,
]

const STOMA = [
  /\b(end\s+|loop\s+|permanent\s+)?(colo|ileo)stomy\b/i,
  /\bstoma\b/i,
]

const VISIBLE_BLEED = [
  /\bhaemorrhoid/i,
  /\bhemorrhoid/i,
  /\binternal\s+piles?\b/i,
  /\bexternal\s+piles?\b/i,
  /\banal\s+fissure\b/i,
  /\bfissure-in-ano\b/i,
]

const ANTICOAG = [
  /\b(apixaban|rivaroxaban|dabigatran|edoxaban|warfarin|enoxaparin|tinzaparin|dalteparin)\b/i,
  /\b(DOAC|NOAC)\b/,
]

const RECENT_IMAGING = [
  /\bCT\s+(?:abdomen|chest|TAP|colonography|CTVC|AP)\b/i,
  /\bMRI\s+(?:rectum|pelvis)\b/i,
  /\bcolonoscopy\b/i,
  /\bflexible?\s+sigmoidoscopy\b/i,
  /\bFOS\b/,
]

const PALLIATIVE = [
  /\bpalliative\b/i,
  /\bend[-\s]of[-\s]life\b/i,
  /\bmetastatic\b/i,
  /\bbest\s+supportive\s+care\b/i,
  /\bDNACPR\b/i,
]

function tryMatch(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[0]
  }
  return null
}

export function scanClinicalText(
  text: string,
  source: string,
): TextScanHit[] {
  if (!text || text.length < 3) return []
  const hits: TextScanHit[] = []

  const surgery = tryMatch(text, BOWEL_SURGERY_ANATOMY)
  if (surgery) {
    hits.push({
      category: 'bowel_surgery_anatomy_change',
      match: surgery.toLowerCase(),
      source,
      message: `"${surgery}" found in ${source}. Confirm the patient's anatomy supports the recommended investigation — colonoscopy / CTVC may not be appropriate after major bowel resection.`,
    })
  }
  const stoma = tryMatch(text, STOMA)
  if (stoma) {
    hits.push({
      category: 'stoma',
      match: stoma.toLowerCase(),
      source,
      message: `"${stoma}" found in ${source}. Bowel prep and scope access differ for stoma patients — confirm the prep / approach is suitable.`,
    })
  }
  const bleed = tryMatch(text, VISIBLE_BLEED)
  if (bleed) {
    hits.push({
      category: 'visible_bleed_source',
      match: bleed.toLowerCase(),
      source,
      message: `"${bleed}" found in ${source}. Per NICE NG12, bleeding with a clearly identified benign source may not require 2WW investigation — consider routine FOS or discharge if no other red flags.`,
    })
  }
  const anticoag = tryMatch(text, ANTICOAG)
  if (anticoag) {
    hits.push({
      category: 'anticoagulant',
      match: anticoag.toLowerCase(),
      source,
      message: `"${anticoag}" found in ${source}. Plan bridging / hold per Trust anticoagulation protocol before any scope.`,
    })
  }
  const imaging = tryMatch(text, RECENT_IMAGING)
  if (imaging) {
    hits.push({
      category: 'recent_imaging',
      match: imaging.toLowerCase(),
      source,
      message: `"${imaging}" found in ${source}. If within the last 2 years, the "recent investigation" routing exception may apply (discuss with COW before repeating).`,
    })
  }
  const palliative = tryMatch(text, PALLIATIVE)
  if (palliative) {
    hits.push({
      category: 'palliative_or_advanced_disease',
      match: palliative.toLowerCase(),
      source,
      message: `"${palliative}" found in ${source}. Consider whether 2WW investigation is in the patient's best interest — discuss with COW / MDT.`,
    })
  }

  return hits
}

/**
 * Deduplicate hits across fields so we don't repeat the same warning
 * twice when both PMH and surgical history mention the same surgery.
 */
export function dedupeHits(hits: TextScanHit[]): TextScanHit[] {
  const seen = new Set<string>()
  const out: TextScanHit[] = []
  for (const h of hits) {
    const key = `${h.category}|${h.match}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(h)
  }
  return out
}
