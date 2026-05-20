import type { Intake } from '../schema/intake'
import type { DecisionResult, PathStep } from './types'
import { ALGORITHM_VERSION } from './version'

/**
 * PLACEHOLDER ENGINE.
 *
 * Real Trust algorithm (IDA / CIBH / FIT-positive asymptomatic / weight loss /
 * abdo-rectal mass branches) will replace this once the encoded rules are
 * signed off against the PDF. Every leaf returns a versioned DecisionResult
 * with a full path so the v2 logic can be swapped in without changing the UI.
 *
 * Current placeholder rule: FIT >= 10 -> colonoscopy, else discharge.
 */
export function decide(intake: Intake): DecisionResult {
  const path: PathStep[] = []
  const warnings: string[] = []
  const now = new Date().toISOString()

  path.push({
    nodeId: 'ROOT',
    label: 'Tel/F2F 2WW Investigation Algorithm — entry',
  })

  const fit = intake.fit
  if (fit == null) {
    path.push({
      nodeId: 'PLACEHOLDER.NO_FIT',
      label: 'No FIT value supplied',
      evidence: 'FIT field empty',
    })
    warnings.push(
      'FIT value missing. Most pathways require FIT. Real algorithm will route via FIT-VE branches or request FIT before triage.',
    )
    return {
      investigation: 'discuss_with_cow',
      rationale:
        'Placeholder rule: no FIT supplied. Real algorithm will branch into FIT-negative pathways and check anaemia/risk factors.',
      algorithmNodeId: 'PLACEHOLDER.NO_FIT',
      alternatives: [
        { investigation: 'colonoscopy', when: 'If FIT >= 10 ug/g once available' },
        { investigation: 'colon_capsule', when: 'If FIT-VE but symptomatic with risk factors' },
      ],
      path,
      algorithm: ALGORITHM_VERSION,
      computedAt: now,
      warnings,
    }
  }

  if (fit >= 10) {
    path.push({
      nodeId: 'PLACEHOLDER.FIT_POS',
      label: 'FIT >= 10 ug/g',
      evidence: `FIT = ${fit} ug/g`,
    })
    return {
      investigation: 'colonoscopy',
      rationale:
        'Placeholder rule: FIT positive. Real algorithm will check IDA, fitness, prior failed scopes, and route accordingly.',
      algorithmNodeId: 'PLACEHOLDER.FIT_POS',
      alternatives: [
        {
          investigation: 'ctc',
          when: 'Age >= 80, prep concerns, poor performance status',
        },
        {
          investigation: 'colonoscopy_plus_ogd',
          when: 'Confirmed iron deficiency anaemia',
        },
        {
          investigation: 'ct_ap',
          when: 'Not fit for bowel prep / poor mobility / age >= 90',
        },
      ],
      path,
      algorithm: ALGORITHM_VERSION,
      computedAt: now,
      warnings,
    }
  }

  path.push({
    nodeId: 'PLACEHOLDER.FIT_NEG',
    label: 'FIT < 10 ug/g',
    evidence: `FIT = ${fit} ug/g`,
  })
  return {
    investigation: 'discharge_to_gp',
    rationale:
      'Placeholder rule: FIT negative. Real algorithm will check anaemia / family history / IBD / previous CRC / symptoms before discharge.',
    algorithmNodeId: 'PLACEHOLDER.FIT_NEG',
    alternatives: [
      {
        investigation: 'colon_capsule',
        when: 'FIT-VE but anaemia, FHx CRC, previous CRC, IBD',
      },
      {
        investigation: 'colonoscopy',
        when: 'Concerning symptoms persist despite FIT-VE',
      },
    ],
    path,
    algorithm: ALGORITHM_VERSION,
    computedAt: now,
    warnings,
  }
}
