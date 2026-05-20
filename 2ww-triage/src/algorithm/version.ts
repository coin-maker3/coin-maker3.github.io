/**
 * Algorithm version metadata. Every DecisionResult stamps this so audits can
 * tell which iteration of the Trust 2WW guidance was applied.
 *
 * Bump on any rule change. Keep `source` accurate so the PDF can be retrieved
 * from the Trust intranet for verification.
 */
export const ALGORITHM_VERSION = {
  id: 'GEH-2WW-COLORECTAL',
  version: '0.1.0-placeholder',
  description:
    'Placeholder rules pending encoding of Trust algorithm PDF. Single rule: FIT >= 10 -> colonoscopy.',
  source: 'LATEST_2WW_INVESTIGATIONS__ALGORITHM_4.pdf',
  effectiveFrom: '2026-05-20',
  encodedAt: new Date().toISOString(),
} as const

export type AlgorithmVersion = typeof ALGORITHM_VERSION
