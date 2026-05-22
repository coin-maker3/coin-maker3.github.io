/**
 * Conservative regex scan for accidental patient identifiers in audit
 * free-text fields. We never block save — clinicians can override — but
 * we surface a warning so the FY1 has one more chance to redact before
 * the data lands in KV.
 *
 * Designed for high precision (low false-positive) on common NHS PID
 * shapes, accepting that determined exfiltration is out of scope for a
 * client-side check.
 */

export interface PidHit {
  pattern: 'nhs_number' | 'dob' | 'dob_keyword' | 'nhs_keyword' | 'hosp_number'
  match: string
}

const NHS_NUMBER = /\b\d{3}\s?\d{3}\s?\d{4}\b/
const DOB_DATE = /\b\d{1,2}[/.-]\d{1,2}[/.-](?:\d{2}|\d{4})\b/
const DOB_KEYWORD = /\b(?:d\.?o\.?b\.?|born(?:\s+on)?[:\s])/i
const NHS_KEYWORD = /\b(?:nhs\s?(?:no|number|#))/i
const HOSP_NUMBER = /\b[A-Z]{1,3}\d{6,8}\b/

export function scanForPid(text: string): PidHit[] {
  if (!text) return []
  const hits: PidHit[] = []
  const m1 = text.match(NHS_NUMBER)
  if (m1) hits.push({ pattern: 'nhs_number', match: m1[0] })
  const m2 = text.match(DOB_DATE)
  if (m2) hits.push({ pattern: 'dob', match: m2[0] })
  const m3 = text.match(DOB_KEYWORD)
  if (m3) hits.push({ pattern: 'dob_keyword', match: m3[0] })
  const m4 = text.match(NHS_KEYWORD)
  if (m4) hits.push({ pattern: 'nhs_keyword', match: m4[0] })
  const m5 = text.match(HOSP_NUMBER)
  if (m5) hits.push({ pattern: 'hosp_number', match: m5[0] })
  return hits
}

export const PID_LABELS: Record<PidHit['pattern'], string> = {
  nhs_number: '10-digit number (looks like an NHS number)',
  dob: 'date (looks like a date of birth)',
  dob_keyword: 'DOB / "born" keyword',
  nhs_keyword: 'NHS number reference',
  hosp_number: 'capitals+digits (looks like a hospital number)',
}
