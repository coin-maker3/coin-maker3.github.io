import type { AlgorithmVersion } from './version'

export const INVESTIGATIONS = [
  'colonoscopy',
  'colonoscopy_plus_ogd',
  'ctc',
  'ctc_plus_ogd',
  'ct_tap',
  'ct_ap',
  'flexible_sigmoidoscopy',
  'colon_capsule',
  'mdt_discussion',
  'discharge_to_gp',
  'discuss_with_cow',
] as const

export type Investigation = (typeof INVESTIGATIONS)[number]

export const INVESTIGATION_LABELS: Record<Investigation, string> = {
  colonoscopy: 'Colonoscopy',
  colonoscopy_plus_ogd: 'Colonoscopy + OGD',
  ctc: 'CT colonography (CTC)',
  ctc_plus_ogd: 'CTC + OGD',
  ct_tap: 'CT TAP',
  ct_ap: 'CT abdomen + pelvis',
  flexible_sigmoidoscopy: 'Flexible sigmoidoscopy',
  colon_capsule: 'Colon capsule endoscopy',
  mdt_discussion: 'Discuss at colorectal MDT',
  discharge_to_gp: 'Discharge to GP with advice',
  discuss_with_cow: 'Discuss with Consultant of the Week',
}

export interface PathStep {
  /** Algorithm node ID, traceable to the PDF (e.g. "IDA.2a", "FIT_POS.3"). */
  nodeId: string
  /** Human-readable description of the branch taken. */
  label: string
  /** The data point that led to this branch. */
  evidence?: string
}

export interface DecisionResult {
  investigation: Investigation
  rationale: string
  algorithmNodeId: string
  alternatives: Array<{
    investigation: Investigation
    when: string
  }>
  /** Full traversal from root to leaf. */
  path: PathStep[]
  algorithm: AlgorithmVersion
  /** Time this decision was computed. */
  computedAt: string
  /** Warnings or caveats surfaced for the clinician to consider. */
  warnings: string[]
}
