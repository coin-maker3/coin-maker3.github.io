/**
 * Algorithm version metadata. Every DecisionResult stamps this so audits can
 * tell which iteration of the Trust 2WW guidance was applied.
 *
 * Bump on any rule change. Keep `source` accurate so the PDF can be retrieved
 * from the Trust intranet for verification.
 */
export const ALGORITHM_VERSION = {
  id: 'GEH-2WW-COLORECTAL',
  version: '0.3.0',
  description:
    'Trust 2WW algorithm encoded: IDA / mass / CIBH-bleeding (FIT-driven) / ' +
    'asymptomatic FIT+ / weight loss / no-criteria branches. v0.3.0 adds the ' +
    '"No rectal mass" sub-branch from PDF page 1 (mass referral with no exam ' +
    'mass → discharge if asymptomatic, else "investigate as appropriate" with ' +
    '"consider FOS / downgrade" warning); telephone-clinic mass-referral ' +
    'warning; IDA discharge-with-no-haematinics letter per p3 footnote ***; ' +
    'colon-capsule refusal fallback per p3 footnote ****; OGD barium-swallow ' +
    'alternative per p3 footnote *.',
  source: 'LATEST_2WW_INVESTIGATIONS__ALGORITHM_4.pdf',
  effectiveFrom: '2026-05-24',
  encodedAt: new Date().toISOString(),
} as const

export type AlgorithmVersion = typeof ALGORITHM_VERSION
