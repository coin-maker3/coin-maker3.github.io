/**
 * Algorithm version metadata. Every DecisionResult stamps this so audits can
 * tell which iteration of the Trust 2WW guidance was applied.
 *
 * Bump on any rule change. Keep `source` accurate so the PDF can be retrieved
 * from the Trust intranet for verification.
 */
export const ALGORITHM_VERSION = {
  id: 'GEH-2WW-COLORECTAL',
  version: '0.4.0',
  description:
    'Trust 2WW algorithm encoded: IDA / mass / CIBH-bleeding (FIT-driven) / ' +
    'asymptomatic FIT+ / weight loss / no-criteria branches. v0.3.0 added ' +
    '"No rectal mass" sub-branch + p3 footnote operational warnings. v0.4.0 ' +
    'adds the Abnormal-CT branch (PDF page 1 right side: colonic/rectal ' +
    'thickening → colonoscopy / CTVC / MDT by age + fitness; other → MDT or ' +
    'discharge); structured visible-bleed-source field (haemorrhoids/fissure ' +
    '→ NICE NG12 downgrade warning); structured prior-bowel-surgery field ' +
    '(subtotal/total colectomy / APR / pouch → anatomy-mismatch warnings); ' +
    'plus a free-text scanner that surfaces clinically material phrases ' +
    '(surgery, stoma, bleed source, anticoagulant, recent imaging, ' +
    'palliative care) written into PMH / surgical hx / exam findings / ' +
    'referral notes when the matching structured field was not ticked.',
  source: 'LATEST_2WW_INVESTIGATIONS__ALGORITHM_4.pdf',
  effectiveFrom: '2026-05-24',
  encodedAt: new Date().toISOString(),
} as const

export type AlgorithmVersion = typeof ALGORITHM_VERSION
