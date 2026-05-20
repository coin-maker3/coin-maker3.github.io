/**
 * Algorithm version metadata. Every DecisionResult stamps this so audits can
 * tell which iteration of the Trust 2WW guidance was applied.
 *
 * Bump on any rule change. Keep `source` accurate so the PDF can be retrieved
 * from the Trust intranet for verification.
 */
export const ALGORITHM_VERSION = {
  id: 'GEH-2WW-COLORECTAL',
  version: '0.2.0',
  description:
    'Trust 2WW algorithm encoded: IDA / mass / CIBH-bleeding (FIT-driven) / ' +
    'asymptomatic FIT+ / weight loss / no-criteria branches. IDA takes ' +
    'priority over referral reason when bloods meet IDA criteria.',
  source: 'LATEST_2WW_INVESTIGATIONS__ALGORITHM_4.pdf',
  effectiveFrom: '2026-05-20',
  encodedAt: new Date().toISOString(),
} as const

export type AlgorithmVersion = typeof ALGORITHM_VERSION
