import { describe, expect, it } from 'vitest'
import { decide } from './engine'
import { DEFAULT_INTAKE, type Intake } from '../schema/intake'

const base = (overrides: Partial<Intake> = {}): Intake => ({
  ...DEFAULT_INTAKE,
  ...overrides,
})

describe('IDA branch (top priority)', () => {
  it('GP referral for CIBH + IDA on bloods → Colonoscopy + OGD', () => {
    // The user-reported case. GP referred for CIBH; bloods show IDA on arrival.
    // IDA priority rule must win regardless of original referral reason.
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        sex: 'F',
        ageBand: '60-69',
        hb: 95, // low
        mcv: 70, // low microcytic
        ferritin: 8, // <30
        fit: 180,
      }),
    )
    expect(result.investigation).toBe('colonoscopy_plus_ogd')
    expect(result.algorithmNodeId).toBe('IDA.col_ogd')
    expect(result.path.some((p) => p.nodeId === 'IDA.priority_over_referral')).toBe(true)
  })

  it('Pure IDA (no GI symptoms) in fit patient → Colonoscopy + OGD', () => {
    const result = decide(
      base({
        referralReasons: ['iron_deficiency_anaemia'],
        sex: 'M',
        ageBand: '60-69',
        hb: 110,
        ferritin: 15,
        fit: null,
      }),
    )
    expect(result.investigation).toBe('colonoscopy_plus_ogd')
  })

  it('IDA in 85yo → CTVC + OGD', () => {
    const result = decide(
      base({
        referralReasons: ['iron_deficiency_anaemia'],
        sex: 'F',
        ageBand: '80-89',
        hb: 100,
        ferritin: 12,
      }),
    )
    expect(result.investigation).toBe('ctc_plus_ogd')
    expect(result.algorithmNodeId).toBe('IDA.ctc_ogd')
  })

  it('IDA in 92yo → CT TAP', () => {
    const result = decide(
      base({
        referralReasons: ['iron_deficiency_anaemia'],
        sex: 'F',
        ageBand: '>=90',
        hb: 90,
        ferritin: 8,
      }),
    )
    expect(result.investigation).toBe('ct_tap')
    expect(result.algorithmNodeId).toBe('IDA.ct_tap')
  })

  it('IDA + not fit for prep + poor mobility → CT TAP', () => {
    const result = decide(
      base({
        referralReasons: ['iron_deficiency_anaemia'],
        sex: 'F',
        ageBand: '70-79',
        hb: 95,
        ferritin: 10,
        fitForBowelPrep: 'no',
        mobilityAids: 'yes',
      }),
    )
    expect(result.investigation).toBe('ct_tap')
  })

  it('IDA detected on Hb+MCV only (no ferritin) → warns about footnote', () => {
    const result = decide(
      base({
        referralReasons: ['iron_deficiency_anaemia'],
        sex: 'F',
        ageBand: '60-69',
        hb: 105,
        mcv: 72, // low MCV qualifies
        ferritin: null,
      }),
    )
    expect(result.investigation).toBe('colonoscopy_plus_ogd')
    expect(result.warnings.some((w) => /ferritin/i.test(w))).toBe(true)
  })

  it('Low Hb but normal MCV and normal ferritin → NOT IDA, falls through', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        sex: 'F',
        ageBand: '60-69',
        hb: 100,
        mcv: 90, // normocytic
        ferritin: 80, // normal
        fit: 100,
      }),
    )
    expect(result.investigation).not.toBe('colonoscopy_plus_ogd')
    // Should go down CIBH FIT+ branch
    expect(result.algorithmNodeId).toMatch(/^CIBH\./)
  })
})

describe('Mass branch (F2F only)', () => {
  it('Rectal mass on PR, fit, not tender → Colonoscopy', () => {
    const result = decide(
      base({
        clinicType: 'face_to_face',
        referralReasons: ['rectal_mass'],
        ageBand: '60-69',
        palpableRectalMass: 'yes',
        rectalMassLowAndTender: 'no',
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
    expect(result.algorithmNodeId).toBe('MASS.rectal.standard')
  })

  it('Low and tender rectal mass → discuss with COW', () => {
    const result = decide(
      base({
        clinicType: 'face_to_face',
        referralReasons: ['rectal_mass'],
        palpableRectalMass: 'yes',
        rectalMassLowAndTender: 'yes',
      }),
    )
    expect(result.investigation).toBe('discuss_with_cow')
  })

  it('Rectal mass + not fit for prep → flexible sigmoidoscopy', () => {
    const result = decide(
      base({
        clinicType: 'face_to_face',
        palpableRectalMass: 'yes',
        fitForBowelPrep: 'no',
        ageBand: '80-89',
      }),
    )
    expect(result.investigation).toBe('flexible_sigmoidoscopy')
  })

  it('Abdo mass, fit, <90 → CTVC', () => {
    const result = decide(
      base({
        clinicType: 'face_to_face',
        referralReasons: ['abdominal_mass'],
        palpableAbdoMass: 'yes',
      }),
    )
    expect(result.investigation).toBe('ctc')
    expect(result.algorithmNodeId).toBe('MASS.abdo.ctvc')
  })

  it('Abdo mass + poor mobility → CT AP', () => {
    const result = decide(
      base({
        clinicType: 'face_to_face',
        palpableAbdoMass: 'yes',
        mobilityAids: 'yes',
      }),
    )
    expect(result.investigation).toBe('ct_ap')
  })

  it('Mass found in telephone clinic → warns to bring patient in', () => {
    const result = decide(
      base({
        clinicType: 'telephone',
        palpableAbdoMass: 'yes',
      }),
    )
    expect(result.warnings.some((w) => /F2F|face/i.test(w))).toBe(true)
  })
})

describe('CIBH / Rectal Bleeding branch', () => {
  it('CIBH + FIT positive + fit → Colonoscopy', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        ageBand: '60-69',
        fit: 50,
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
    expect(result.algorithmNodeId).toBe('CIBH.fit_pos.colonoscopy')
  })

  it('CIBH + FIT positive + age 82 → CTVC', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        ageBand: '80-89',
        fit: 50,
      }),
    )
    expect(result.investigation).toBe('ctc')
    expect(result.algorithmNodeId).toBe('CIBH.fit_pos.ctc')
  })

  it('CIBH + FIT positive + age 92 → CT AP', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        ageBand: '>=90',
        fit: 50,
      }),
    )
    expect(result.investigation).toBe('ct_ap')
  })

  it('CIBH + no FIT sent → treated as positive', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        ageBand: '60-69',
        fit: null,
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
    expect(result.path.some((p) => /No FIT/.test(p.label))).toBe(true)
  })

  it('CIBH + FIT negative + no risk factors → Colon capsule', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        ageBand: '60-69',
        fit: 5,
      }),
    )
    expect(result.investigation).toBe('colon_capsule')
  })

  it('CIBH + FIT negative + FHx CRC → investigate as FIT positive (Colonoscopy)', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        ageBand: '60-69',
        fit: 5,
        fhxCrcOrIbd: 'yes',
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
  })

  it('CIBH + FIT negative + non-IDA anaemia → investigate as FIT positive', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        sex: 'F',
        ageBand: '60-69',
        hb: 110, // low but not IDA (normal MCV + normal ferritin)
        mcv: 90,
        ferritin: 80,
        fit: 5,
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
  })

  it('CIBH + FIT negative + no risk + age 82 → CTVC instead of capsule', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        ageBand: '80-89',
        fit: 5,
      }),
    )
    expect(result.investigation).toBe('ctc')
  })

  it('PR bleeding only (no CIBH) routes via same branch', () => {
    const result = decide(
      base({
        referralReasons: ['rectal_bleeding'],
        prBleed: 'bright',
        ageBand: '50-59',
        fit: 30,
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
  })
})

describe('Asymptomatic FIT positive branch', () => {
  it('Asymptomatic + FIT 30 + no risk factors → Colon capsule', () => {
    const result = decide(
      base({
        referralReasons: ['asymptomatic_fit_positive'],
        ageBand: '50-59',
        fit: 30,
      }),
    )
    expect(result.investigation).toBe('colon_capsule')
    expect(result.algorithmNodeId).toBe('ASYMPT.fit_low.capsule')
  })

  it('Asymptomatic + FIT 80 + no risk factors → Colonoscopy (FIT>=50 = treat as +ve)', () => {
    const result = decide(
      base({
        referralReasons: ['asymptomatic_fit_positive'],
        ageBand: '50-59',
        fit: 80,
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
  })

  it('Asymptomatic + FIT 30 + FHx CRC → Colonoscopy (risk factors override)', () => {
    const result = decide(
      base({
        referralReasons: ['asymptomatic_fit_positive'],
        ageBand: '50-59',
        fit: 30,
        fhxCrcOrIbd: 'yes',
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
  })

  it('Asymptomatic FIT+ with IDA → IDA branch takes priority', () => {
    const result = decide(
      base({
        referralReasons: ['asymptomatic_fit_positive'],
        sex: 'F',
        ageBand: '60-69',
        fit: 25,
        hb: 100,
        ferritin: 10,
      }),
    )
    expect(result.investigation).toBe('colonoscopy_plus_ogd')
    expect(result.algorithmNodeId).toMatch(/^IDA\./)
  })
})

describe('Weight loss branch', () => {
  it('Weight loss + FIT+ + >3kg → CTVC + OGD', () => {
    const result = decide(
      base({
        referralReasons: ['weight_loss'],
        weightLoss: 'yes',
        weightLossKg: 5,
        ageBand: '60-69',
        fit: 30, // positive — moves out of the discharge clause
      }),
    )
    expect(result.investigation).toBe('ctc_plus_ogd')
  })

  it('Weight loss + FIT+ + <=3kg → CTVC alone', () => {
    const result = decide(
      base({
        referralReasons: ['weight_loss'],
        weightLoss: 'yes',
        weightLossKg: 2,
        ageBand: '60-69',
        fit: 30,
      }),
    )
    expect(result.investigation).toBe('ctc')
  })

  it('Weight loss + elderly + FIT+ → CT AP', () => {
    const result = decide(
      base({
        referralReasons: ['weight_loss'],
        weightLoss: 'yes',
        weightLossKg: 2,
        ageBand: '80-89',
        fit: 30,
      }),
    )
    expect(result.investigation).toBe('ct_ap')
  })

  it('Weight loss + previous CRC → CT chest warning surfaced', () => {
    const result = decide(
      base({
        referralReasons: ['weight_loss'],
        weightLoss: 'yes',
        weightLossKg: 4,
        ageBand: '60-69',
        previousCRC: 'yes', // previous CRC = risk factor → stays in investigation arm
        fit: 5,
      }),
    )
    expect(result.warnings.some((w) => /CT chest/i.test(w))).toBe(true)
    expect(result.investigation).toBe('ctc_plus_ogd')
  })

  it('Weight loss + FIT-VE + no risk factors + asymptomatic → discharge', () => {
    const result = decide(
      base({
        referralReasons: ['weight_loss'],
        weightLoss: 'yes',
        weightLossKg: 2,
        ageBand: '60-69',
        fit: 5,
      }),
    )
    expect(result.investigation).toBe('discharge_to_gp')
  })
})

describe('Routing exceptions', () => {
  it('Recent colonoscopy within 2y → discuss with COW', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        priorColonoscopyWithin2y: 'yes',
        priorColonoscopyFindings: 'Diverticulosis only, 18 months ago',
      }),
    )
    expect(result.investigation).toBe('discuss_with_cow')
    expect(result.algorithmNodeId).toBe('ROUTE.RECENT_INV')
  })

  it('No criteria met → discharge to GP', () => {
    const result = decide(base({}))
    expect(result.investigation).toBe('discharge_to_gp')
    expect(result.algorithmNodeId).toBe('ROUTE.NO_CRITERIA')
  })
})

describe('Output contract', () => {
  it('Every decision stamps algorithm version + timestamp + path', () => {
    const result = decide(base({ fit: 50, cibh: 'yes' }))
    expect(result.algorithm.id).toBe('GEH-2WW-COLORECTAL')
    expect(result.algorithm.version).toBe('0.2.0')
    expect(result.path.length).toBeGreaterThan(0)
    expect(() => new Date(result.computedAt).toISOString()).not.toThrow()
  })
})
