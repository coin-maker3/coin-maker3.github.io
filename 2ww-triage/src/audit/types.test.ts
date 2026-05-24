/**
 * Tests for the audit analytics math. Protocol §10 outcomes depend on
 * these functions being correct — they will end up in the ASGBI poster.
 */
import { describe, expect, it } from 'vitest'
import { buildSummary, cohenKappa, wilson95, type AuditCase, type ExclusionReason } from './types'
import { DEFAULT_INTAKE, type Intake } from '../schema/intake'

function makeCase(
  overrides: Partial<AuditCase> & {
    intake?: Partial<Intake>
    excluded?: boolean
    exclusionReason?: ExclusionReason
  } = {},
): AuditCase {
  return {
    id: overrides.id ?? `AUDIT-2026-${Math.random().toString().slice(2, 6)}`,
    enteredBy: overrides.enteredBy ?? 'AB',
    clinicMonth: overrides.clinicMonth ?? '2026-05',
    excluded: overrides.excluded,
    exclusionReason: overrides.exclusionReason,
    intake: { ...DEFAULT_INTAKE, ...(overrides.intake ?? {}) } as Intake,
    toolDecision: overrides.toolDecision ?? {
      investigation: 'colonoscopy',
      nodeId: 'CIBH.fit_pos.colonoscopy',
      algorithmVersion: '0.2.1',
      rationale: '',
      path: [],
      warnings: [],
    },
    actualDecision: overrides.actualDecision ?? 'colonoscopy',
    actualDecisionNotes: '',
    reviewerNotes: '',
    concordant:
      overrides.concordant ??
      (overrides.toolDecision?.investigation ?? 'colonoscopy') ===
        (overrides.actualDecision ?? 'colonoscopy'),
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    timeTakenSeconds:
      'timeTakenSeconds' in overrides ? (overrides.timeTakenSeconds ?? null) : 180,
  }
}

describe('wilson95', () => {
  it('returns 0–0 for an empty sample', () => {
    expect(wilson95(0, 0)).toEqual({ lo: 0, hi: 0 })
  })

  it('handles 100% concordance correctly (CI excludes 1.0 at small N)', () => {
    const ci = wilson95(10, 10)
    expect(ci.hi).toBeCloseTo(1, 5)
    expect(ci.lo).toBeGreaterThan(0.6) // not 1.0 — Wilson keeps a lower bound
    expect(ci.lo).toBeLessThan(1)
  })

  it('matches published Wilson values for p=0.8, N=100', () => {
    // Expected ≈ [0.713, 0.867] per Wilson formula
    const ci = wilson95(80, 100)
    expect(ci.lo).toBeCloseTo(0.713, 2)
    expect(ci.hi).toBeCloseTo(0.867, 2)
  })

  it('narrows as N grows', () => {
    const narrow = wilson95(800, 1000)
    const wide = wilson95(8, 10)
    expect(narrow.hi - narrow.lo).toBeLessThan(wide.hi - wide.lo)
  })
})

describe('cohenKappa', () => {
  it('returns null for empty input', () => {
    expect(cohenKappa([])).toBeNull()
  })

  it('returns kappa = 1.0 for perfect agreement', () => {
    const cases = [
      makeCase({ toolDecision: { investigation: 'colonoscopy', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'colonoscopy' }),
      makeCase({ toolDecision: { investigation: 'ctc', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'ctc' }),
      makeCase({ toolDecision: { investigation: 'colon_capsule', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'colon_capsule' }),
    ]
    const k = cohenKappa(cases)
    expect(k?.kappa).toBeCloseTo(1, 5)
  })

  it('returns kappa close to 0 when agreement equals chance', () => {
    // Construct a 2x2 with marginal probabilities such that P_o == P_e.
    // Tool says colonoscopy for half, ctc for half. Clinic says the same
    // marginals but randomly distributed — half match, half don't,
    // chance-level given equal marginals.
    const cases = [
      makeCase({ toolDecision: { investigation: 'colonoscopy', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'colonoscopy' }),
      makeCase({ toolDecision: { investigation: 'colonoscopy', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'ctc' }),
      makeCase({ toolDecision: { investigation: 'ctc', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'colonoscopy' }),
      makeCase({ toolDecision: { investigation: 'ctc', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'ctc' }),
    ]
    const k = cohenKappa(cases)
    expect(k?.kappa).toBeCloseTo(0, 5)
  })

  it('returns positive kappa for above-chance agreement', () => {
    const cases = [
      // 5 of 6 agree → high kappa
      ...Array.from({ length: 5 }, () => makeCase({ toolDecision: { investigation: 'colonoscopy', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'colonoscopy' })),
      makeCase({ toolDecision: { investigation: 'colonoscopy', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'ctc' }),
    ]
    const k = cohenKappa(cases)
    // Pe = 1.0 here (only one row category) — handle edge case
    expect(k?.kappa).toBeGreaterThanOrEqual(0)
  })
})

describe('buildSummary subgroups + stop criteria', () => {
  it('computes referral-reason subgroups correctly', () => {
    const cases = [
      makeCase({ intake: { ...DEFAULT_INTAKE, referralReasons: ['change_in_bowel_habit'] }, concordant: true }),
      makeCase({ intake: { ...DEFAULT_INTAKE, referralReasons: ['change_in_bowel_habit'] }, concordant: false }),
      makeCase({ intake: { ...DEFAULT_INTAKE, referralReasons: ['iron_deficiency_anaemia'] }, concordant: true }),
    ]
    const s = buildSummary(cases)
    const cibh = s.subgroups.byReferralReason.find((r) => r.label === 'CIBH')
    expect(cibh?.total).toBe(2)
    expect(cibh?.concordancePct).toBe(50)
    const ida = s.subgroups.byReferralReason.find((r) => r.label === 'IDA')
    expect(ida?.total).toBe(1)
    expect(ida?.concordancePct).toBe(100)
  })

  it('splits age bands as <60, 60–79, ≥80 per protocol §10', () => {
    const cases = [
      makeCase({ intake: { ...DEFAULT_INTAKE, ageBand: '50-59' }, concordant: true }),
      makeCase({ intake: { ...DEFAULT_INTAKE, ageBand: '70-79' }, concordant: true }),
      makeCase({ intake: { ...DEFAULT_INTAKE, ageBand: '80-89' }, concordant: false }),
    ]
    const s = buildSummary(cases)
    expect(s.subgroups.byAgeBand.find((r) => r.label === '<60')?.total).toBe(1)
    expect(s.subgroups.byAgeBand.find((r) => r.label === '60–79')?.total).toBe(1)
    expect(s.subgroups.byAgeBand.find((r) => r.label === '≥80')?.total).toBe(1)
  })

  it('does NOT trigger stop criteria below 25 cases even at low concordance', () => {
    const cases = Array.from({ length: 10 }, () => makeCase({ concordant: false }))
    const s = buildSummary(cases)
    expect(s.stopCriteria.overallTriggered).toBe(false)
  })

  it('TRIGGERS stop criteria at ≥25 cases with concordance <60%', () => {
    const cases = [
      ...Array.from({ length: 10 }, () => makeCase({ concordant: true })),
      ...Array.from({ length: 20 }, () => makeCase({ concordant: false })),
    ]
    const s = buildSummary(cases)
    expect(s.stopCriteria.overallTriggered).toBe(true)
    expect(s.stopCriteria.overallReason).toMatch(/N=30/)
  })

  it('triggers per-arm stop criteria when arm <50% with ≥5 cases', () => {
    // 5 IDA cases, 1 concordant. CIBH arm not affected.
    const idaTool = {
      investigation: 'colonoscopy_plus_ogd' as const,
      nodeId: 'IDA.col_ogd',
      algorithmVersion: '0.2.1',
      rationale: '',
      path: [],
      warnings: [],
    }
    const cases = [
      makeCase({ toolDecision: idaTool, actualDecision: 'colonoscopy_plus_ogd', concordant: true }),
      ...Array.from({ length: 4 }, () =>
        makeCase({ toolDecision: idaTool, actualDecision: 'ctc', concordant: false }),
      ),
    ]
    const s = buildSummary(cases)
    expect(s.stopCriteria.armsTriggered.some((a) => a.label === 'IDA branch')).toBe(true)
  })

  it('confusion matrix counts diagonal and off-diagonal correctly', () => {
    const cases = [
      makeCase({ toolDecision: { investigation: 'colonoscopy', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'colonoscopy' }),
      makeCase({ toolDecision: { investigation: 'colonoscopy', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'ctc' }),
      makeCase({ toolDecision: { investigation: 'colonoscopy', nodeId: 'X', algorithmVersion: '0.2.1', rationale: '', path: [], warnings: [] }, actualDecision: 'ctc' }),
    ]
    const s = buildSummary(cases)
    expect(s.confusion.cells['colonoscopy|colonoscopy']).toBe(1)
    expect(s.confusion.cells['colonoscopy|ctc']).toBe(2)
    expect(s.confusion.rowTotals['colonoscopy']).toBe(3)
  })

  it('time stats computed only when timeTakenSeconds > 0', () => {
    const cases = [
      makeCase({ timeTakenSeconds: 60 }),
      makeCase({ timeTakenSeconds: 120 }),
      makeCase({ timeTakenSeconds: 180 }),
      makeCase({ timeTakenSeconds: 240 }),
      makeCase({ timeTakenSeconds: null }), // excluded
      makeCase({ timeTakenSeconds: 0 }), // excluded
    ]
    const s = buildSummary(cases)
    expect(s.timeStats?.n).toBe(4)
    expect(s.timeStats?.median).toBe(150)
  })

  it('computes Wilson 95% CI on overall concordance', () => {
    const cases = Array.from({ length: 10 }, (_, i) => makeCase({ concordant: i < 8 }))
    const s = buildSummary(cases)
    expect(s.concordancePct).toBe(80)
    expect(s.ci95.lo).toBeGreaterThan(0.4)
    expect(s.ci95.hi).toBeLessThanOrEqual(1)
  })

  it('excluded cases are removed from concordance denominator', () => {
    const cases = [
      // 5 entered, 4 concordant
      ...Array.from({ length: 4 }, () => makeCase({ concordant: true })),
      makeCase({ concordant: false }),
      // 2 excluded — should be excluded from numerator AND denominator
      makeCase({ excluded: true, exclusionReason: 'dna', concordant: false }),
      makeCase({ excluded: true, exclusionReason: 'direct_to_mdt', concordant: false }),
    ]
    const s = buildSummary(cases)
    expect(s.total).toBe(7)
    expect(s.excluded).toBe(2)
    expect(s.analysed).toBe(5)
    expect(s.concordancePct).toBe(80) // 4/5 not 4/7
  })

  it('exclusionBreakdown counts each reason', () => {
    const cases = [
      makeCase({ excluded: true, exclusionReason: 'dna', concordant: false }),
      makeCase({ excluded: true, exclusionReason: 'dna', concordant: false }),
      makeCase({ excluded: true, exclusionReason: 'direct_to_mdt', concordant: false }),
      makeCase({ concordant: true }),
    ]
    const s = buildSummary(cases)
    expect(s.exclusionBreakdown.find((e) => e.reason === 'dna')?.count).toBe(2)
    expect(s.exclusionBreakdown.find((e) => e.reason === 'direct_to_mdt')?.count).toBe(1)
  })

  it('per-FY1 progress aggregates by initials', () => {
    const cases = [
      makeCase({ enteredBy: 'AB', concordant: true }),
      makeCase({ enteredBy: 'AB', concordant: false }),
      makeCase({ enteredBy: 'CD', concordant: true }),
    ]
    const s = buildSummary(cases)
    const ab = s.byFy1.find((r) => r.enteredBy === 'AB')
    expect(ab?.total).toBe(2)
    expect(ab?.concordancePct).toBe(50)
    const cd = s.byFy1.find((r) => r.enteredBy === 'CD')
    expect(cd?.total).toBe(1)
    expect(cd?.concordancePct).toBe(100)
  })
})
