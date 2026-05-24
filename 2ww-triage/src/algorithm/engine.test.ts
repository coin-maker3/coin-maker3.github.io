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

describe('Audit fixes (v0.2.0 → v0.2.1)', () => {
  it('IDA + age 70 + mobility aids → CTVC + OGD (poor mobility added to CTVC arm)', () => {
    const result = decide(
      base({
        referralReasons: ['iron_deficiency_anaemia'],
        sex: 'F',
        ageBand: '70-79',
        hb: 100,
        ferritin: 10,
        mobilityAids: 'yes',
      }),
    )
    expect(result.investigation).toBe('ctc_plus_ogd')
    expect(result.algorithmNodeId).toBe('IDA.ctc_ogd')
  })

  it('IDA + age 60 + dependent ADLs → CTVC + OGD (poor mobility)', () => {
    const result = decide(
      base({
        referralReasons: ['iron_deficiency_anaemia'],
        sex: 'F',
        ageBand: '60-69',
        hb: 100,
        ferritin: 10,
        independentADLs: 'no',
      }),
    )
    expect(result.investigation).toBe('ctc_plus_ogd')
  })

  it('CIBH FIT+ + age 65 + mobility aids → CTVC (was Colonoscopy)', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        ageBand: '60-69',
        fit: 50,
        mobilityAids: 'yes',
      }),
    )
    expect(result.investigation).toBe('ctc')
    expect(result.algorithmNodeId).toBe('CIBH.fit_pos.ctc')
  })

  it('Isolated tenesmus + FIT+ → Colonoscopy (tenesmus now triggers CIBH branch)', () => {
    const result = decide(
      base({
        ageBand: '60-69',
        tenesmus: 'yes',
        fit: 30,
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
    expect(result.algorithmNodeId).toBe('CIBH.fit_pos.colonoscopy')
  })

  it('Isolated mucus PR + FIT+ → Colonoscopy (mucus PR now triggers CIBH branch)', () => {
    const result = decide(
      base({
        ageBand: '50-59',
        mucusPR: 'yes',
        fit: 25,
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
  })

  it('Weight loss + elderly + heavy (>3kg) → CT AP + OGD (was CTVC + OGD)', () => {
    const result = decide(
      base({
        referralReasons: ['weight_loss'],
        weightLoss: 'yes',
        weightLossKg: 5,
        ageBand: '80-89',
        fit: 30,
      }),
    )
    expect(result.investigation).toBe('ct_ap_plus_ogd')
  })

  it('Lacks capacity + telephone clinic → Book F2F clinic', () => {
    const result = decide(
      base({
        clinicType: 'telephone',
        lacksCapacity: 'yes',
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
      }),
    )
    expect(result.investigation).toBe('book_f2f_clinic')
    expect(result.algorithmNodeId).toBe('ROUTE.LACKS_CAPACITY')
  })

  it('Lacks capacity but already F2F → continues normal triage', () => {
    const result = decide(
      base({
        clinicType: 'face_to_face',
        lacksCapacity: 'yes',
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        fit: 30,
        ageBand: '60-69',
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
  })
})

describe('Output contract', () => {
  it('Every decision stamps algorithm version + timestamp + path', () => {
    const result = decide(base({ fit: 50, cibh: 'yes' }))
    expect(result.algorithm.id).toBe('GEH-2WW-COLORECTAL')
    expect(result.algorithm.version).toBe('0.4.0')
    expect(result.path.length).toBeGreaterThan(0)
    expect(() => new Date(result.computedAt).toISOString()).not.toThrow()
  })
})

describe('v0.3.0: PDF page 1 "No rectal mass" sub-branch', () => {
  it('19yo F, F2F, referred rectal mass, bright bleeding, no mass on exam → still Colonoscopy BUT with FOS/downgrade warning', () => {
    // The case Mr Ali surfaced from the live tool screenshot — without the new
    // sub-branch the audit could not distinguish "tool says colonoscopy"
    // from "tool says colonoscopy and flags possible downgrade".
    const result = decide(
      base({
        clinicType: 'face_to_face',
        ageBand: '<40',
        age: 19,
        sex: 'F',
        referralReasons: ['rectal_mass'],
        prBleed: 'bright',
        palpableAbdoMass: 'no',
        palpableRectalMass: 'no',
        hb: 140,
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
    expect(result.warnings.some((w) => /no mass on examination/i.test(w))).toBe(true)
    expect(result.warnings.some((w) => /downgrade|FOS/i.test(w))).toBe(true)
    expect(result.path.some((p) => p.nodeId === 'MASS.no_mass_referred.with_symptoms')).toBe(true)
  })

  it('Referred rectal mass, no mass on exam, no other symptoms → discharge with mass-specific rationale', () => {
    const result = decide(
      base({
        clinicType: 'face_to_face',
        ageBand: '60-69',
        age: 67,
        sex: 'F',
        referralReasons: ['rectal_mass'],
        palpableAbdoMass: 'no',
        palpableRectalMass: 'no',
        prBleed: 'none',
        cibh: 'no',
        weightLoss: 'no',
        fit: 4,
      }),
    )
    expect(result.investigation).toBe('discharge_to_gp')
    expect(result.algorithmNodeId).toBe('MASS.no_mass_referred.discharge')
    expect(result.rationale).toMatch(/no mass found on examination/i)
  })

  it('Referred abdominal mass, no mass on exam, no other symptoms → discharge with mass-specific rationale', () => {
    const result = decide(
      base({
        clinicType: 'face_to_face',
        ageBand: '60-69',
        age: 65,
        sex: 'M',
        referralReasons: ['abdominal_mass'],
        palpableAbdoMass: 'no',
        palpableRectalMass: 'no',
        prBleed: 'none',
        cibh: 'no',
        weightLoss: 'no',
        fit: null,
      }),
    )
    expect(result.investigation).toBe('discharge_to_gp')
    expect(result.algorithmNodeId).toBe('MASS.no_mass_referred.discharge')
  })

  it('Referred rectal mass + actual mass on exam → unaffected (no warning, normal mass-branch flow)', () => {
    const result = decide(
      base({
        clinicType: 'face_to_face',
        ageBand: '60-69',
        sex: 'M',
        referralReasons: ['rectal_mass'],
        palpableRectalMass: 'yes',
        rectalMassLowAndTender: 'no',
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
    expect(result.warnings.some((w) => /no mass on examination/i.test(w))).toBe(false)
  })
})

describe('v0.3.0: Telephone clinic + mass referral warning', () => {
  it('Telephone clinic + rectal mass referral → warn that F2F is required', () => {
    const result = decide(
      base({
        clinicType: 'telephone',
        ageBand: '60-69',
        sex: 'F',
        referralReasons: ['rectal_mass'],
        // can't examine on telephone, so palpable flags default to 'no'
      }),
    )
    expect(result.warnings.some((w) => /telephone.*F2F|Bring patient in/i.test(w))).toBe(true)
  })
})

describe('v0.3.0: Operational footnote warnings', () => {
  it('Colon capsule recommendation → warn about refusal fallback (urgent col / urgent CTVC limited prep)', () => {
    const result = decide(
      base({
        referralReasons: ['change_in_bowel_habit'],
        cibh: 'yes',
        sex: 'F',
        ageBand: '60-69',
        fit: 4, // FIT negative
        fitForBowelPrep: 'yes',
        whoScore: 0,
      }),
    )
    expect(result.investigation).toBe('colon_capsule')
    expect(result.warnings.some((w) => /capsule.*rejected|refuses|optical colonoscopy.*urgent/i.test(w))).toBe(true)
  })

  it('Any OGD recommendation → warn about barium swallow alternative', () => {
    const result = decide(
      base({
        referralReasons: ['iron_deficiency_anaemia'],
        sex: 'F',
        ageBand: '60-69',
        hb: 95,
        mcv: 70,
        ferritin: 8,
      }),
    )
    expect(result.investigation).toBe('colonoscopy_plus_ogd')
    expect(result.warnings.some((w) => /barium swallow/i.test(w))).toBe(true)
  })
})

describe('v0.3.0: IDA discharge-no-haematinics letter pathway', () => {
  it('Low Hb + no ferritin + no other symptoms → discharge with "no haematinics sent" warning', () => {
    const result = decide(
      base({
        sex: 'F',
        ageBand: '60-69',
        hb: 105, // low for female
        mcv: 88, // normal — so hasIDA is false
        ferritin: null,
        referralReasons: ['other'],
        cibh: 'no',
        prBleed: 'none',
        weightLoss: 'no',
        fit: null,
      }),
    )
    expect(result.investigation).toBe('discharge_to_gp')
    expect(result.warnings.some((w) => /haematinics/i.test(w))).toBe(true)
  })
})

describe('v0.4.0: Abnormal CT branch (PDF page 1 right side)', () => {
  it('Abnormal CT thickening, <80 + fit for prep → Colonoscopy', () => {
    const result = decide(
      base({
        clinicType: 'face_to_face',
        ageBand: '60-69',
        sex: 'F',
        abnormalCt: 'colonic_rectal_thickening',
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
    expect(result.algorithmNodeId).toBe('ABCT.thickening.colonoscopy')
  })

  it('Abnormal CT thickening, ≥80 → CTVC with FOS alternative for left-sided', () => {
    const result = decide(
      base({
        ageBand: '80-89',
        sex: 'M',
        abnormalCt: 'colonic_rectal_thickening',
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.investigation).toBe('ctc')
    expect(result.algorithmNodeId).toBe('ABCT.thickening.ctc')
    expect(result.alternatives.some((a) => a.investigation === 'flexible_sigmoidoscopy')).toBe(true)
  })

  it('Abnormal CT thickening, not fit for prep + poor mobility + ≥90 → MDT discussion', () => {
    const result = decide(
      base({
        ageBand: '>=90',
        sex: 'F',
        abnormalCt: 'colonic_rectal_thickening',
        fitForBowelPrep: 'no',
        mobilityAids: 'yes',
      }),
    )
    expect(result.investigation).toBe('mdt_discussion')
    expect(result.algorithmNodeId).toBe('ABCT.thickening.mdt')
  })

  it('Abnormal CT "other" → MDT discussion / discharge to GP alternative', () => {
    const result = decide(
      base({
        ageBand: '60-69',
        sex: 'M',
        abnormalCt: 'other',
      }),
    )
    expect(result.investigation).toBe('mdt_discussion')
    expect(result.algorithmNodeId).toBe('ABCT.other')
  })

  it('IDA still takes priority over abnormal CT thickening', () => {
    const result = decide(
      base({
        ageBand: '60-69',
        sex: 'F',
        hb: 95,
        mcv: 70,
        ferritin: 8,
        abnormalCt: 'colonic_rectal_thickening',
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.investigation).toBe('colonoscopy_plus_ogd')
    expect(result.algorithmNodeId.startsWith('IDA.')).toBe(true)
  })
})

describe('v0.4.0: Prior bowel surgery anatomy warnings', () => {
  it('Subtotal colectomy + colonoscopy recommended → warn no colon to scope', () => {
    const result = decide(
      base({
        ageBand: '60-69',
        sex: 'M',
        priorBowelSurgery: 'subtotal_colectomy',
        cibh: 'yes',
        fit: 50,
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
    expect(result.warnings.some((w) => /subtotal colectomy/i.test(w))).toBe(true)
  })

  it('APR + flexible sigmoidoscopy → warn no rectum / anal canal', () => {
    // Force the engine to recommend FOS via the rectal-mass-unfit-prep branch.
    const result = decide(
      base({
        clinicType: 'face_to_face',
        ageBand: '70-79',
        sex: 'F',
        priorBowelSurgery: 'apr',
        palpableRectalMass: 'yes',
        fitForBowelPrep: 'no',
      }),
    )
    expect(result.investigation).toBe('flexible_sigmoidoscopy')
    expect(result.warnings.some((w) => /APR.*no rectum|anatomically/i.test(w))).toBe(true)
  })

  it('Pouch reconstruction + colonoscopy → warn pouchoscopy is appropriate scope', () => {
    const result = decide(
      base({
        ageBand: '60-69',
        sex: 'M',
        priorBowelSurgery: 'pouch_reconstruction',
        cibh: 'yes',
        fit: 50,
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.warnings.some((w) => /pouchoscopy/i.test(w))).toBe(true)
  })
})

describe('v0.4.0: Visible bleeding source (NICE NG12 downgrade prompt)', () => {
  it('Bright PR bleeding + visible haemorrhoids → engine recommends colonoscopy BUT warns about downgrade', () => {
    const result = decide(
      base({
        ageBand: '<40',
        age: 19,
        sex: 'F',
        prBleed: 'bright',
        bleedingSourceVisible: 'haemorrhoids',
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.investigation).toBe('colonoscopy')
    expect(result.warnings.some((w) => /haemorrhoids.*bleeding source/i.test(w))).toBe(true)
    expect(result.warnings.some((w) => /NICE NG12|downgrade/i.test(w))).toBe(true)
  })

  it('Bright PR bleeding + fissure → same downgrade prompt fires', () => {
    const result = decide(
      base({
        ageBand: '40-49',
        sex: 'M',
        prBleed: 'bright',
        bleedingSourceVisible: 'fissure',
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.warnings.some((w) => /fissure.*bleeding source/i.test(w))).toBe(true)
  })

  it('Bright PR bleeding + no visible source on exam → no downgrade prompt (unexplained bleeding)', () => {
    const result = decide(
      base({
        ageBand: '50-59',
        sex: 'F',
        prBleed: 'bright',
        bleedingSourceVisible: 'none',
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.warnings.some((w) => /bleeding source/i.test(w))).toBe(false)
  })
})

describe('v0.4.0: Free-text scanner', () => {
  it('PMH mentions "subtotal colectomy" but structured field is "none" → free-text warning fires', () => {
    const result = decide(
      base({
        ageBand: '60-69',
        sex: 'M',
        priorBowelSurgery: 'none', // structured field empty
        pmh: 'Hypertension, type 2 diabetes. Previous subtotal colectomy 2018 for diverticular disease.',
        cibh: 'yes',
        fit: 50,
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.warnings.some((w) => /Free-text scan.*subtotal colectom/i.test(w))).toBe(true)
  })

  it('Exam findings mentions "haemorrhoids" but structured bleed-source field is "unknown" → free-text warning fires', () => {
    const result = decide(
      base({
        ageBand: '50-59',
        sex: 'M',
        prBleed: 'bright',
        bleedingSourceVisible: 'unknown',
        examinationFindings: 'DRE: external haemorrhoids visible, no mass',
        fitForBowelPrep: 'yes',
      }),
    )
    expect(result.warnings.some((w) => /Free-text scan.*haemorrhoid/i.test(w))).toBe(true)
  })

  it('Drug history mentions "apixaban" but onAnticoag is "no" → free-text warning fires', () => {
    const result = decide(
      base({
        ageBand: '60-69',
        sex: 'F',
        onAnticoag: 'no', // structured field says no
        drugHistory: 'apixaban 5mg bd, simvastatin',
        cibh: 'yes',
      }),
    )
    expect(result.warnings.some((w) => /Free-text scan.*apixaban/i.test(w))).toBe(true)
  })

  it('Free-text mentions stoma → warns about bowel-prep / approach', () => {
    const result = decide(
      base({
        ageBand: '60-69',
        sex: 'M',
        pmh: 'End colostomy following Hartmann procedure',
        cibh: 'yes',
      }),
    )
    expect(result.warnings.some((w) => /Free-text scan.*colostomy|stoma/i.test(w))).toBe(true)
  })

  it('Suppression: structured prior-surgery field IS ticked → no duplicate free-text warning for same surgery', () => {
    const result = decide(
      base({
        ageBand: '60-69',
        sex: 'M',
        priorBowelSurgery: 'subtotal_colectomy', // ticked
        pmh: 'Previous subtotal colectomy 2018', // same info in text
        cibh: 'yes',
        fit: 50,
        fitForBowelPrep: 'yes',
      }),
    )
    // Should warn once via structured field, NOT a second time via free-text scan
    const surgeryWarnings = result.warnings.filter((w) => /subtotal colectom/i.test(w))
    expect(surgeryWarnings.length).toBe(1)
    expect(surgeryWarnings[0].startsWith('[Free-text scan]')).toBe(false)
  })
})
