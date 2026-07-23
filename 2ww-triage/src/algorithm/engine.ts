import type { AgeBand, Intake } from '../schema/intake'
import type { DecisionResult, Investigation, PathStep } from './types'
import { ALGORITHM_VERSION } from './version.js'
import { dedupeHits, scanClinicalText } from './text-scan.js'

// ---------- threshold constants ----------
//
// IDA detection thresholds. Trust PDF specifies "Low Hb + low MCV or Ferritin
// <30". Hb cut-offs follow NICE/BCG: <130 g/L male, <120 g/L female. MCV cut-off
// <80 fL (microcytic). Ferritin <30 ug/L is explicit on the PDF.

const HB_LOW_MALE = 130
const HB_LOW_FEMALE = 120
const MCV_LOW = 80
const FERRITIN_LOW = 30
const FIT_POSITIVE = 10 // NICE NG12 / BSG threshold
const FIT_ASYMPT_HIGH = 50 // Trust algo: if asymptomatic + FIT>=50 investigate as FIT+
const WEIGHT_LOSS_OGD_KG = 3 // PDF footnote: OGD if >3kg loss

// ---------- helpers (pure) ----------

const isAge80Plus = (a: AgeBand) => a === '80-89' || a === '>=90'
const isAge90Plus = (a: AgeBand) => a === '>=90'

const hasPoorMobility = (i: Intake) =>
  i.mobilityAids === 'yes' || i.independentADLs === 'no'

const isUnfitForPrep = (i: Intake) => i.fitForBowelPrep === 'no'

const hasFITPositive = (i: Intake): boolean | null => {
  if (i.fit == null) return null // unknown = treat as positive in CIBH/bleeding branch
  return i.fit >= FIT_POSITIVE
}

const hasIDA = (i: Intake): boolean => {
  if (i.hb == null) return false
  const lowHb = i.sex === 'M' ? i.hb < HB_LOW_MALE : i.hb < HB_LOW_FEMALE
  if (!lowHb) return false
  const lowMCV = i.mcv != null && i.mcv < MCV_LOW
  const lowFerritin = i.ferritin != null && i.ferritin < FERRITIN_LOW
  return lowMCV || lowFerritin
}

const hasAnyAnaemia = (i: Intake): boolean => {
  if (i.hb == null) return false
  return i.sex === 'M' ? i.hb < HB_LOW_MALE : i.hb < HB_LOW_FEMALE
}

const hasRiskFactors = (i: Intake): boolean =>
  i.fhxCrcOrIbd === 'yes' ||
  i.previousCRC === 'yes' ||
  i.ibd === 'yes' ||
  hasAnyAnaemia(i)

const hasMass = (i: Intake): boolean =>
  i.palpableAbdoMass === 'yes' || i.palpableRectalMass === 'yes'

const hasCIBHorBleeding = (i: Intake): boolean =>
  i.cibh === 'yes' ||
  i.prBleed !== 'none' ||
  i.tenesmus === 'yes' || // NICE NG12 red flag; PDF treats tenesmus with mass pathway
  i.mucusPR === 'yes' || // colorectal red flag
  i.referralReasons.includes('change_in_bowel_habit') ||
  i.referralReasons.includes('rectal_bleeding')

const hasSignificantWeightLoss = (i: Intake): boolean =>
  i.weightLoss === 'yes' ||
  i.referralReasons.includes('weight_loss')

const wantsAsymptomaticFITPos = (i: Intake): boolean =>
  i.referralReasons.includes('asymptomatic_fit_positive') &&
  i.fit != null &&
  i.fit >= FIT_POSITIVE

// ---------- engine ----------

const now = () => new Date().toISOString()

const make = (
  investigation: Investigation,
  rationale: string,
  nodeId: string,
  path: PathStep[],
  alternatives: DecisionResult['alternatives'],
  warnings: string[] = [],
): DecisionResult => ({
  investigation,
  rationale,
  algorithmNodeId: nodeId,
  alternatives,
  path,
  algorithm: ALGORITHM_VERSION,
  computedAt: now(),
  warnings,
})

export function decide(intake: Intake): DecisionResult {
  return postProcess(decideCore(intake), intake)
}

function decideCore(intake: Intake): DecisionResult {
  const path: PathStep[] = [
    {
      nodeId: 'ROOT',
      label: 'Tel/F2F 2WW Investigation Algorithm — entry',
    },
  ]

  // ----- Routing exceptions first (PDF page 2 bottom rows) -----

  if (intake.lacksCapacity === 'yes' && intake.clinicType === 'telephone') {
    path.push({
      nodeId: 'ROUTE.LACKS_CAPACITY',
      label: 'Unable to comply with tel clinic / lacks capacity',
      evidence: 'Patient cannot complete telephone assessment',
    })
    return make(
      'book_f2f_clinic',
      'Patient lacks capacity for telephone consultation or unable to comply. Book F2F clinic appointment per Trust pathway.',
      'ROUTE.LACKS_CAPACITY',
      path,
      [{ investigation: 'mdt_discussion', when: 'If capacity issues persist after F2F review' }],
    )
  }

  if (intake.priorColonoscopyWithin2y === 'yes' || intake.priorCtvcWithin2y === 'yes') {
    const which =
      intake.priorColonoscopyWithin2y === 'yes' && intake.priorCtvcWithin2y === 'yes'
        ? 'colonoscopy and CTVC'
        : intake.priorColonoscopyWithin2y === 'yes'
          ? 'colonoscopy'
          : 'CTVC'
    const findings =
      [intake.priorColonoscopyFindings, intake.priorCtvcFindings]
        .filter((s) => s && s.trim().length > 0)
        .join('; ') || `Patient reports ${which} <2y`
    path.push({
      nodeId: 'ROUTE.RECENT_INV',
      label: `Recent (last 2 years) GI investigation: ${which}`,
      evidence: findings,
    })
    return make(
      'discuss_with_cow',
      `Recent ${which} within 2 years. Per Trust PDF page 2 routing column: discuss with clinic consultant or COW before requesting repeat investigation.`,
      'ROUTE.RECENT_INV',
      path,
      [
        { investigation: 'colonoscopy', when: 'After COW discussion, if repeat scope agreed' },
        { investigation: 'mdt_discussion', when: 'If recent findings suggestive of malignancy' },
      ],
    )
  }

  // ----- 1. IDA branch (top priority over symptom-driven branches) -----

  if (hasIDA(intake)) {
    return decideIDA(intake, path)
  }

  // ----- 1a. Abnormal CT branch (PDF page 1 right side) -----
  // The patient came in with CT findings already — the workup is dictated by
  // what the CT showed, not by symptoms. Fires after IDA (IDA still wins
  // because it needs both upper + lower GI investigation).

  if (intake.abnormalCt === 'colonic_rectal_thickening') {
    return decideAbnormalCtThickening(intake, path)
  }
  if (intake.abnormalCt === 'other') {
    path.push({
      nodeId: 'ABCT.other',
      label: 'Abnormal CT — other finding (not colonic / rectal thickening)',
      evidence: 'abnormalCt = other',
    })
    return make(
      'mdt_discussion',
      'Abnormal CT with finding outside the colonic/rectal thickening pathway. Per Trust PDF page 1: list for discussion at the relevant MDT, or discharge with letter to GP to re-refer to the correct speciality.',
      'ABCT.other',
      path,
      [
        { investigation: 'discharge_to_gp', when: 'If finding belongs to a different speciality — re-refer letter to GP' },
      ],
    )
  }

  // ----- 2. Palpable mass on examination (page 1 algorithm) -----

  if (hasMass(intake)) {
    return decideMass(intake, path)
  }

  // ----- 3. Significant unintentional weight loss -----
  // Only takes priority if weight loss is the dominant referral reason — i.e.
  // patient has no concurrent CIBH/bleeding (those route through their own
  // FIT-driven branch).

  if (
    hasSignificantWeightLoss(intake) &&
    !hasCIBHorBleeding(intake) &&
    !wantsAsymptomaticFITPos(intake)
  ) {
    return decideWeightLoss(intake, path)
  }

  // ----- 4. CIBH or Rectal Bleeding (FIT-driven) -----

  if (hasCIBHorBleeding(intake)) {
    return decideCIBHorBleeding(intake, path)
  }

  // ----- 5. Asymptomatic FIT positive -----

  if (
    intake.referralReasons.includes('asymptomatic_fit_positive') ||
    (intake.fit != null && intake.fit >= FIT_POSITIVE && !hasCIBHorBleeding(intake))
  ) {
    return decideAsymptomaticFITPos(intake, path)
  }

  // ----- 6. Doesn't meet criteria -----

  path.push({
    nodeId: 'ROUTE.NO_CRITERIA',
    label: 'Does not meet criteria for further investigation',
    evidence: 'No IDA, no mass, no CIBH/bleeding, no weight loss, no FIT+',
  })
  return make(
    'discharge_to_gp',
    'Patient does not meet 2WW investigation criteria on the Trust algorithm. Discharge to GP with letter documenting findings. Ask GP to check FIT if not already done and re-refer if positive.',
    'ROUTE.NO_CRITERIA',
    path,
    [
      { investigation: 'colon_capsule', when: 'If risk factors emerge or FIT becomes positive' },
    ],
  )
}

// ---------- IDA branch ----------

function decideIDA(intake: Intake, path: PathStep[]): DecisionResult {
  const warnings: string[] = []

  path.push({
    nodeId: 'IDA.entry',
    label: 'IDA detected — Low Hb + (low MCV or ferritin <30)',
    evidence: `Hb ${intake.hb}, MCV ${intake.mcv ?? 'unknown'}, ferritin ${intake.ferritin ?? 'unknown'}`,
  })

  // Warn if bloods incomplete
  if (intake.ferritin == null && intake.mcv == null) {
    warnings.push(
      'IDA suspected on Hb alone. Per Trust footnote, IDA referrals must have ferritin — chase before requesting scope.',
    )
  }
  if (intake.ferritin == null) {
    warnings.push(
      'No ferritin recorded. Trust footnote: if no ferritin, check MCV; if low MCV consider investigations as per IDA and request ferritin.',
    )
  }

  // Note IDA takes priority — flag the original referral reason
  if (intake.referralReasons.length > 0 && !intake.referralReasons.includes('iron_deficiency_anaemia')) {
    const reasons = intake.referralReasons.join(', ')
    path.push({
      nodeId: 'IDA.priority_over_referral',
      label: 'IDA criteria override original referral reason',
      evidence: `GP referred for: ${reasons}. IDA needs upper AND lower GI investigation.`,
    })
  }

  const age90 = isAge90Plus(intake.ageBand)
  const age80 = isAge80Plus(intake.ageBand)
  const poorMob = hasPoorMobility(intake)
  const notFit = isUnfitForPrep(intake)

  // CT TAP — not fit for any scope/prep
  if (age90 || (notFit && poorMob)) {
    path.push({
      nodeId: 'IDA.ct_tap',
      label: 'Not fit for prep / poor mobility / >=90 yrs',
      evidence: `age ${intake.ageBand}, mobility aids: ${intake.mobilityAids}, fit for prep: ${intake.fitForBowelPrep}`,
    })
    return make(
      'ct_tap',
      'IDA in patient unfit for bowel prep or scopes. CT TAP per Trust IDA branch. No CT chest indication for IDA per footnote.',
      'IDA.ct_tap',
      path,
      [
        { investigation: 'mdt_discussion', when: 'If equivocal CT findings' },
      ],
      warnings,
    )
  }

  // CTVC + OGD — older / unfit for full prep / poor mobility (still tolerates limited prep)
  if (age80 || notFit || poorMob) {
    path.push({
      nodeId: 'IDA.ctc_ogd',
      label: 'Previous failed/challenging colonoscopy, >=80 yrs, comorbid, or poor mobility',
      evidence: `age ${intake.ageBand}, fit for prep: ${intake.fitForBowelPrep}, mobility aids: ${intake.mobilityAids}`,
    })
    return make(
      'ctc_plus_ogd',
      'IDA + age >=80 or unfit for full prep. CTVC (limited prep) + OGD per Trust IDA branch. OGD investigates upper GI iron-loss source.',
      'IDA.ctc_ogd',
      path,
      [
        { investigation: 'ct_tap', when: 'If unable to tolerate any prep or poor mobility' },
      ],
      warnings,
    )
  }

  // Standard: Colonoscopy + OGD
  path.push({
    nodeId: 'IDA.col_ogd',
    label: 'Fit for bowel prep',
    evidence: `age ${intake.ageBand}, WHO ${intake.whoScore}, fit for prep: ${intake.fitForBowelPrep}`,
  })
  return make(
    'colonoscopy_plus_ogd',
    'IDA criteria met (low Hb + low MCV or ferritin <30). Per Trust algorithm, IDA needs both upper and lower GI investigation regardless of original referral reason. Bowel prep fit → Colonoscopy + OGD.',
    'IDA.col_ogd',
    path,
    [
      { investigation: 'ctc_plus_ogd', when: 'If colonoscopy fails / patient unable to tolerate full prep' },
      { investigation: 'ct_tap', when: 'If patient deteriorates and becomes unfit for any scope/prep' },
    ],
    warnings,
  )
}

// ---------- Abnormal CT — colonic / rectal thickening (Page 1 right) ----------

function decideAbnormalCtThickening(intake: Intake, path: PathStep[]): DecisionResult {
  path.push({
    nodeId: 'ABCT.thickening.entry',
    label: 'Abnormal CT — colonic / rectal thickening or colonic pathology',
    evidence: 'abnormalCt = colonic_rectal_thickening',
  })

  const age90 = isAge90Plus(intake.ageBand)
  const age80 = isAge80Plus(intake.ageBand)
  const poorMob = hasPoorMobility(intake)
  const notFit = isUnfitForPrep(intake)

  // Tier 3: Not fit for prep + poor mobility + ≥90 → MDT, exam, FIT, discussion
  if (notFit && poorMob && age90) {
    path.push({
      nodeId: 'ABCT.thickening.mdt',
      label: 'Not fit for prep + poor mobility + ≥90 yrs → MDT discussion, clinical exam, FIT, discuss with patient/NOK',
    })
    return make(
      'mdt_discussion',
      'Abnormal CT thickening in patient ≥90 yrs, not fit for prep and poor mobility. Per Trust PDF page 1: discharge at colorectal MDT, clinical examination, FIT test, discussion with patient / NOK.',
      'ABCT.thickening.mdt',
      path,
      [
        { investigation: 'discharge_to_gp', when: 'After MDT if patient declines or unfit for any investigation' },
      ],
    )
  }

  // Tier 2: ≥80 / not fit for sedation or prep → CTVC (+/- limited prep, +/- FOS for left-sided)
  if (age80 || notFit) {
    path.push({
      nodeId: 'ABCT.thickening.ctc',
      label: '≥80 yrs OR not fit for sedation / bowel prep → CTVC',
      evidence: `age ${intake.ageBand}, fit for prep: ${intake.fitForBowelPrep}`,
    })
    return make(
      'ctc',
      'Abnormal CT thickening in patient ≥80 or not fit for sedation / bowel prep. Per Trust PDF page 1: CTVC (+/- limited prep). Add FOS with enema if rectal, sigmoid or left colonic thickening.',
      'ABCT.thickening.ctc',
      path,
      [
        { investigation: 'flexible_sigmoidoscopy', when: 'Add FOS with enema if rectal / sigmoid / left colonic thickening' },
      ],
    )
  }

  // Tier 1: <80 + fit for prep → Colonoscopy
  path.push({
    nodeId: 'ABCT.thickening.colonoscopy',
    label: '<80 yrs + fit for bowel prep → Colonoscopy',
    evidence: `age ${intake.ageBand}, fit for prep: ${intake.fitForBowelPrep}`,
  })
  return make(
    'colonoscopy',
    'Abnormal CT thickening in patient <80 yrs and fit for bowel prep. Per Trust PDF page 1: Colonoscopy.',
    'ABCT.thickening.colonoscopy',
    path,
    [
      { investigation: 'ctc', when: 'If colonoscopy fails or prep poorly tolerated' },
    ],
  )
}

// ---------- Mass branch (Page 1 — F2F only) ----------

function decideMass(intake: Intake, path: PathStep[]): DecisionResult {
  const warnings: string[] = []

  if (intake.clinicType !== 'face_to_face') {
    warnings.push(
      'Mass identified but clinic is telephone. Mass pathway requires F2F clinic — bring patient in.',
    )
  }

  // Rectal mass takes precedence over abdo mass (lower in algorithm)
  if (intake.palpableRectalMass === 'yes') {
    path.push({
      nodeId: 'MASS.rectal',
      label: 'Rectal mass on PR',
      evidence: `Low+tender: ${intake.rectalMassLowAndTender}`,
    })

    if (intake.rectalMassLowAndTender === 'yes') {
      path.push({
        nodeId: 'MASS.rectal.low_tender',
        label: 'Low and tender — discuss with COW for ?EUA',
      })
      return make(
        'discuss_with_cow',
        'Low and tender rectal mass — discuss with COW regarding examination under anaesthetic (EUA) before scoping.',
        'MASS.rectal.low_tender',
        path,
        [
          { investigation: 'colonoscopy', when: 'After COW review if EUA not needed' },
          { investigation: 'flexible_sigmoidoscopy', when: 'If not fit for full prep — FOS with enema +/- CT TAP' },
        ],
        warnings,
      )
    }

    if (isUnfitForPrep(intake)) {
      path.push({
        nodeId: 'MASS.rectal.unfit_prep',
        label: 'Not fit for prep — FOS with enema +/- CT TAP',
      })
      return make(
        'flexible_sigmoidoscopy',
        'Rectal mass with bowel-prep concerns — Flexible sigmoidoscopy with enema +/- CT TAP per Trust mass pathway.',
        'MASS.rectal.unfit_prep',
        path,
        [{ investigation: 'ct_tap', when: 'In addition, to stage if cancer evident' }],
        warnings,
      )
    }

    path.push({
      nodeId: 'MASS.rectal.standard',
      label: 'Standard rectal mass workup',
    })
    return make(
      'colonoscopy',
      'Rectal mass on PR. Colonoscopy (+/- CT TAP and MRI rectum if obvious cancer) per Trust mass pathway.',
      'MASS.rectal.standard',
      path,
      [
        { investigation: 'ct_tap', when: 'In addition for staging if cancer evident' },
      ],
      warnings,
    )
  }

  // Abdo mass
  path.push({
    nodeId: 'MASS.abdo',
    label: 'Palpable abdominal mass',
  })

  if (isAge90Plus(intake.ageBand) || hasPoorMobility(intake)) {
    path.push({
      nodeId: 'MASS.abdo.ct_ap',
      label: 'CT AP — poor mobility or >=90 yrs',
    })
    return make(
      'ct_ap',
      'Abdominal mass with poor mobility or age >=90. CT AP per Trust mass pathway. Not for CT chest in first instance.',
      'MASS.abdo.ct_ap',
      path,
      [{ investigation: 'mdt_discussion', when: 'After CT if mass not bowel-origin' }],
      warnings,
    )
  }

  path.push({
    nodeId: 'MASS.abdo.ctvc',
    label: 'CTVC (limited prep if not fit for prep)',
  })
  return make(
    'ctc',
    'Abdominal mass — CTVC per Trust mass pathway (ask for limited prep if not fit for full prep). Not for CT chest in first instance.',
    'MASS.abdo.ctvc',
    path,
    [
      { investigation: 'ct_ap', when: 'If poor mobility or age >=90' },
    ],
    warnings,
  )
}

// ---------- CIBH / Rectal Bleeding branch ----------

function decideCIBHorBleeding(intake: Intake, path: PathStep[]): DecisionResult {
  const fitPos = hasFITPositive(intake)
  const noFIT = intake.fit == null

  path.push({
    nodeId: 'CIBH.entry',
    label: 'Change in bowel habit or rectal bleeding',
    evidence: `CIBH: ${intake.cibh}, PR bleed: ${intake.prBleed}, FIT: ${intake.fit ?? 'not done'}`,
  })

  // FIT positive OR no FIT → treat as positive
  if (fitPos === true || noFIT) {
    path.push({
      nodeId: 'CIBH.fit_pos_or_unknown',
      label: noFIT ? 'No FIT sent — treat as positive' : `FIT positive (>=${FIT_POSITIVE})`,
      evidence: noFIT ? 'No FIT supplied' : `FIT = ${intake.fit}`,
    })
    return decideCIBHFitPosFitness(intake, path)
  }

  // FIT negative
  path.push({
    nodeId: 'CIBH.fit_neg',
    label: `FIT negative (<${FIT_POSITIVE})`,
    evidence: `FIT = ${intake.fit}`,
  })

  if (hasRiskFactors(intake)) {
    path.push({
      nodeId: 'CIBH.fit_neg.risk_factors',
      label: 'Anaemia (non-IDA), FHx CRC, previous CRC, or IBD — investigate as FIT+',
    })
    return decideCIBHFitPosFitness(intake, path)
  }

  // No risk factors → Colon capsule (or CTVC if elderly/prep concern)
  if (
    isAge80Plus(intake.ageBand) ||
    isUnfitForPrep(intake) ||
    intake.whoScore >= 2
  ) {
    path.push({
      nodeId: 'CIBH.fit_neg.no_risk.ctc',
      label: 'CTVC (no risk factors, >=80 / prep concerns / poor PS)',
    })
    return make(
      'ctc',
      'CIBH/bleeding with FIT negative and no risk factors but age >=80, prep concerns or WHO >=2. CTVC instead of colon capsule.',
      'CIBH.fit_neg.no_risk.ctc',
      path,
      [
        { investigation: 'colon_capsule', when: 'If patient fit and prefers capsule' },
      ],
    )
  }

  path.push({
    nodeId: 'CIBH.fit_neg.no_risk.capsule',
    label: 'Downgrade to urgent — Colon capsule',
  })
  return make(
    'colon_capsule',
    'CIBH/bleeding with FIT negative and no risk factors. Downgrade to urgent investigations and book colon capsule per Trust pathway.',
    'CIBH.fit_neg.no_risk.capsule',
    path,
    [
      { investigation: 'colonoscopy', when: 'If colon capsule rejected/refused' },
      { investigation: 'ctc', when: 'If capsule rejected and not fit for prep' },
    ],
  )
}

function decideCIBHFitPosFitness(intake: Intake, path: PathStep[]): DecisionResult {
  const age90 = isAge90Plus(intake.ageBand)
  const age80 = isAge80Plus(intake.ageBand)
  const poorMob = hasPoorMobility(intake)
  const notFit = isUnfitForPrep(intake)

  if (age90 || (notFit && poorMob)) {
    path.push({
      nodeId: 'CIBH.fit_pos.ct_ap',
      label: 'Not fit for prep / poor mobility / >=90 yrs → CT AP',
    })
    return make(
      'ct_ap',
      'CIBH/bleeding (FIT+ or no FIT) in patient unfit for prep or poor mobility / >=90 yrs. CT AP per Trust pathway.',
      'CIBH.fit_pos.ct_ap',
      path,
      [{ investigation: 'mdt_discussion', when: 'If equivocal CT findings' }],
    )
  }

  if (age80 || notFit || poorMob) {
    const ctcNote =
      intake.tenesmus === 'yes' || intake.palpableRectalMass === 'yes'
        ? ' (+/- FOS if tenesmus or PR mass)'
        : ''
    path.push({
      nodeId: 'CIBH.fit_pos.ctc',
      label: 'Previous failed/challenging col, >=80, comorbid, or poor mobility → CTVC' + ctcNote,
    })
    return make(
      'ctc',
      `CIBH/bleeding (FIT+ or no FIT) in patient >=80 or unfit for full prep. CTVC${ctcNote} per Trust pathway.`,
      'CIBH.fit_pos.ctc',
      path,
      [
        { investigation: 'flexible_sigmoidoscopy', when: 'If tenesmus or PR mass — add FOS' },
      ],
    )
  }

  path.push({
    nodeId: 'CIBH.fit_pos.colonoscopy',
    label: 'Fit for bowel prep → Colonoscopy',
  })
  return make(
    'colonoscopy',
    'CIBH/bleeding with FIT positive (or no FIT) and fit for bowel prep. Colonoscopy per Trust pathway.',
    'CIBH.fit_pos.colonoscopy',
    path,
    [
      { investigation: 'ctc', when: 'If colonoscopy fails or prep poorly tolerated' },
    ],
  )
}

// ---------- Asymptomatic FIT positive branch ----------

function decideAsymptomaticFITPos(intake: Intake, path: PathStep[]): DecisionResult {
  path.push({
    nodeId: 'ASYMPT.entry',
    label: 'Fully asymptomatic but FIT positive',
    evidence: `FIT = ${intake.fit ?? 'unknown'}`,
  })

  if (hasRiskFactors(intake)) {
    path.push({
      nodeId: 'ASYMPT.risk_factors',
      label: 'Anaemia, FHx CRC, previous CRC, IBD, or recently symptomatic — investigate as CIBH FIT+',
    })
    return decideCIBHFitPosFitness(intake, path)
  }

  // No risk factors — split on FIT magnitude
  if (intake.fit != null && intake.fit >= FIT_ASYMPT_HIGH) {
    path.push({
      nodeId: 'ASYMPT.fit_high',
      label: `FIT >=${FIT_ASYMPT_HIGH} — investigate as CIBH FIT+`,
    })
    return decideCIBHFitPosFitness(intake, path)
  }

  path.push({
    nodeId: 'ASYMPT.fit_low',
    label: `FIT <${FIT_ASYMPT_HIGH} — downgrade to urgent, Colon capsule`,
  })

  if (
    isAge80Plus(intake.ageBand) ||
    isUnfitForPrep(intake) ||
    intake.whoScore >= 2
  ) {
    path.push({
      nodeId: 'ASYMPT.fit_low.ctc',
      label: 'CTVC instead — >=80 / prep concerns / poor PS',
    })
    return make(
      'ctc',
      'Asymptomatic FIT positive (FIT<50) with no risk factors but age >=80 / prep concerns / WHO >=2. CTVC per Trust pathway.',
      'ASYMPT.fit_low.ctc',
      path,
      [{ investigation: 'colon_capsule', when: 'If patient fit and prefers capsule' }],
    )
  }

  return make(
    'colon_capsule',
    'Asymptomatic FIT positive with FIT<50 and no risk factors. Downgrade to urgent and book colon capsule per Trust pathway.',
    'ASYMPT.fit_low.capsule',
    path,
    [
      { investigation: 'colonoscopy', when: 'If colon capsule rejected/refused, urgent' },
      { investigation: 'ctc', when: 'If capsule rejected and prep concerns, urgent' },
    ],
  )
}

// ---------- Weight loss branch ----------

function decideWeightLoss(intake: Intake, path: PathStep[]): DecisionResult {
  const warnings: string[] = []

  path.push({
    nodeId: 'WTLOSS.entry',
    label: 'Significant unintentional weight loss',
    evidence: intake.weightLossKg != null ? `${intake.weightLossKg} kg` : 'amount not recorded',
  })

  // If FIT negative + no risk factors + truly asymptomatic → discharge with non-specific symptoms pathway
  if (
    intake.fit != null &&
    intake.fit < FIT_POSITIVE &&
    !hasRiskFactors(intake) &&
    intake.cibh !== 'yes' &&
    intake.prBleed === 'none' &&
    intake.abdominalPain !== 'yes'
  ) {
    path.push({
      nodeId: 'WTLOSS.no_risk_fit_neg',
      label: 'FIT negative, no risk factors, otherwise asymptomatic',
    })
    return make(
      'discharge_to_gp',
      'Weight loss with FIT negative, no risk factors and no other GI symptoms. Discharge to GP with letter — re-refer to non-specific symptoms pathway.',
      'WTLOSS.no_risk_fit_neg',
      path,
      [{ investigation: 'mdt_discussion', when: 'If GP feels non-specific symptoms pathway not appropriate' }],
    )
  }

  // Standard weight-loss workup
  const elderly = isAge80Plus(intake.ageBand)
  const notFit = isUnfitForPrep(intake)
  const heavyLoss = (intake.weightLossKg ?? 0) > WEIGHT_LOSS_OGD_KG

  if (intake.previousCRC === 'yes') {
    warnings.push(
      'Previous colorectal cancer + weight loss — consider CT chest in addition to look for metastases.',
    )
  }

  if (elderly || notFit) {
    path.push({
      nodeId: 'WTLOSS.elderly_or_unfit',
      label: 'Elderly or unfit for full prep — CT AP base',
      evidence: `age ${intake.ageBand}, fit for prep: ${intake.fitForBowelPrep}`,
    })
    return make(
      heavyLoss ? 'ct_ap_plus_ogd' : 'ct_ap',
      `Weight loss in elderly/unfit patient. ${heavyLoss ? 'Heavy weight loss (>3kg) — CT AP + OGD per Trust footnote' : 'CT AP per Trust pathway'}.`,
      heavyLoss ? 'WTLOSS.elderly_ogd' : 'WTLOSS.elderly',
      path,
      [
        { investigation: 'ctc', when: 'If CT AP equivocal — proceed to CTVC' },
      ],
      warnings,
    )
  }

  path.push({
    nodeId: 'WTLOSS.standard',
    label: 'Standard workup — CTVC +/- OGD',
    evidence: heavyLoss ? '>3kg loss — include OGD' : '<=3kg loss — OGD optional',
  })
  return make(
    heavyLoss ? 'ctc_plus_ogd' : 'ctc',
    `Significant unintentional weight loss. CTVC${heavyLoss ? ' + OGD (loss >3kg per Trust footnote)' : ' (+/- OGD if symptomatic upper GI)'}. CT chest only if previous CRC.`,
    heavyLoss ? 'WTLOSS.standard_ogd' : 'WTLOSS.standard',
    path,
    [
      { investigation: 'ct_ap', when: 'If patient deteriorates / becomes unfit for prep' },
    ],
    warnings,
  )
}

// ---------- post-processing (Trust PDF page 1 sub-branches + footnotes) ----------
//
// The core engine handles the main decision tree. These post-process rules
// encode the page 1 "No rectal mass" sub-branch (page 1 left), and the page 3
// footnotes about colon-capsule fallbacks, OGD alternatives, IDA discharge
// pathways, and telephone-clinic limitations.
//
// Anything that needs to OVERRIDE the result (e.g. mass referral + no mass
// + no other symptoms → discharge instead of falling through CIBH) is
// handled here too.

function postProcess(result: DecisionResult, intake: Intake): DecisionResult {
  const warnings = [...result.warnings]
  let { investigation, algorithmNodeId, rationale } = result
  const path = [...result.path]

  const referredForMass =
    intake.referralReasons.includes('rectal_mass') ||
    intake.referralReasons.includes('abdominal_mass')

  const noMassOnExam =
    intake.palpableAbdoMass !== 'yes' && intake.palpableRectalMass !== 'yes'

  // ---- Trust PDF page 1: "No rectal mass" sub-branch ----
  // When patient is referred for mass but exam confirms no mass, the PDF says:
  // "If no other symptoms discharge. If other symptoms investigate as
  //  appropriate. If in doubt, consider FOS."
  if (intake.clinicType === 'face_to_face' && referredForMass && noMassOnExam) {
    if (investigation === 'discharge_to_gp') {
      // Already routed to discharge — replace path with mass-specific node so
      // the audit shows this was the "no mass, no other symptoms" branch,
      // not the generic "no criteria" fallthrough.
      path.push({
        nodeId: 'MASS.no_mass_referred.discharge',
        label: 'Referred for mass, no mass on exam, no other symptoms — discharge per Trust PDF page 1',
        evidence: `Referral: ${intake.referralReasons.join(', ')}; abdo mass: no; rectal mass: no`,
      })
      algorithmNodeId = 'MASS.no_mass_referred.discharge'
      rationale =
        `Patient referred for ${intake.referralReasons.includes('rectal_mass') ? 'rectal' : 'abdominal'} mass but no mass found on examination, and no other symptoms requiring 2WW investigation. Per Trust PDF page 1, discharge with letter to GP.`
    } else {
      // Other symptoms led to a 2WW investigation — keep that recommendation
      // but flag the "consider FOS / downgrade" guidance from the PDF.
      path.push({
        nodeId: 'MASS.no_mass_referred.with_symptoms',
        label: 'Referred for mass, no mass on exam, BUT other symptoms present — investigated as per other branch (PDF page 1: "if in doubt consider FOS")',
        evidence: `Referral: ${intake.referralReasons.join(', ')}; no mass on exam; recommendation came from other-symptom branch`,
      })
      warnings.push(
        `Patient referred for ${intake.referralReasons.includes('rectal_mass') ? 'rectal' : 'abdominal'} mass but no mass on examination. Per Trust PDF page 1: investigate as appropriate for the other symptoms (above) — but if in doubt, consider downgrade to routine FOS or discharge with letter. Clinical judgement required.`,
      )
    }
  }

  // ---- Telephone clinic + mass referral: must bring patient in ----
  if (intake.clinicType === 'telephone' && referredForMass) {
    warnings.push(
      'Referred for mass but telephone clinic — examination required to complete the mass pathway. Bring patient in for F2F before finalising.',
    )
  }

  // ---- Trust PDF page 3, footnote ***: IDA with no haematinics ----
  // If Hb is low but no ferritin sent and patient otherwise asymptomatic /
  // discharged, surface the "no haematinics, ask GP to recheck" letter
  // guidance from the IDA footnote.
  if (
    investigation === 'discharge_to_gp' &&
    intake.hb != null &&
    ((intake.sex === 'M' && intake.hb < HB_LOW_MALE) ||
      (intake.sex === 'F' && intake.hb < HB_LOW_FEMALE)) &&
    intake.ferritin == null
  ) {
    warnings.push(
      'Hb low but ferritin not sent. Per Trust PDF page 3 footnote ***: discharge to GP with letter stating no haematinics sent, re-refer if found to have IDA. Consider asking GP to refer to haematology if persistently low Hb.',
    )
  }

  // ---- Trust PDF page 3, footnote ****: colon capsule fallback ----
  if (investigation === 'colon_capsule') {
    warnings.push(
      'Operational (Trust PDF footnote ****): if patient refuses or colon capsule is rejected, request optical colonoscopy as urgent if fit for bowel prep; otherwise CTVC with limited prep as urgent. Select clinic outcome "Routine — sent for diagnostics, no follow-up required" to downgrade.',
    )
  }

  // ---- Trust PDF page 3, footnote *: OGD alternative ----
  if (
    investigation === 'colonoscopy_plus_ogd' ||
    investigation === 'ctc_plus_ogd' ||
    investigation === 'ct_ap_plus_ogd'
  ) {
    warnings.push(
      'Operational (Trust PDF footnote *): if patient cannot tolerate or refuses OGD, consider barium swallow with counselling on its limitations. No indication for CT chest as investigation for IDA.',
    )
  }

  // ---- v0.4: Prior bowel surgery — anatomy / approach warnings ----
  // Structured field (priorBowelSurgery) drives these so we don't depend on
  // free-text scanning. Most bite when colonoscopy / CTC was recommended.
  const surgery = intake.priorBowelSurgery
  if (surgery && surgery !== 'none') {
    const investigationsUsingColon =
      investigation === 'colonoscopy' ||
      investigation === 'colonoscopy_plus_ogd' ||
      investigation === 'ctc' ||
      investigation === 'ctc_plus_ogd' ||
      investigation === 'flexible_sigmoidoscopy' ||
      investigation === 'colon_capsule'
    if (
      (surgery === 'subtotal_colectomy' || surgery === 'total_colectomy_ileostomy') &&
      investigationsUsingColon
    ) {
      warnings.push(
        `Patient has ${surgery === 'subtotal_colectomy' ? 'subtotal colectomy' : 'total colectomy + ileostomy'}. There is no / minimal colon remaining — ${investigation === 'colon_capsule' || investigation === 'colonoscopy' ? 'standard colonoscopy / colon capsule does not apply' : 'CTVC anatomy is altered'}. Reconsider workup: OGD only if upper GI source suspected, MDT discussion otherwise.`,
      )
    }
    if (surgery === 'apr' && investigation === 'flexible_sigmoidoscopy') {
      warnings.push(
        'Patient has had APR — no rectum / no anal canal. Flexible sigmoidoscopy is not anatomically possible. Reconsider workup.',
      )
    }
    if (surgery === 'pouch_reconstruction' && investigationsUsingColon) {
      warnings.push(
        'Patient has an ileal pouch — pouchoscopy is the appropriate scope, not standard colonoscopy. Confirm scope plan before booking.',
      )
    }
    if (surgery === 'partial_colectomy' && investigationsUsingColon) {
      warnings.push(
        'Patient has had partial colectomy / hemicolectomy. Confirm anastomosis and remaining colon length before booking colonoscopy or CTVC — endoscopist needs to know.',
      )
    }
    if (surgery === 'anterior_resection' && investigation === 'colonoscopy') {
      warnings.push(
        'Patient has had anterior resection. Confirm anastomosis location with operative note before colonoscopy — depth-of-insertion and prep tolerance may differ.',
      )
    }
  }

  // ---- v0.4: Visible bleeding source on examination (NICE NG12 nudge) ----
  // PR bleeding with a clear benign source (haemorrhoids / fissure) may not
  // be "unexplained" rectal bleeding under NICE NG12 — consider downgrade.
  if (
    intake.prBleed !== 'none' &&
    (intake.bleedingSourceVisible === 'haemorrhoids' ||
      intake.bleedingSourceVisible === 'fissure') &&
    investigation !== 'discharge_to_gp' &&
    investigation !== 'mdt_discussion'
  ) {
    warnings.push(
      `Visible ${intake.bleedingSourceVisible} on examination identified as a likely bleeding source. Per NICE NG12, rectal bleeding with a clearly identified benign source may not require 2WW investigation — consider downgrade to routine FOS or discharge with letter if no other red flags. Clinical judgement required.`,
    )
  }

  // ---- v0.4: Free-text scan — surface clinically material phrases the FY1
  // may have written in a free-text field but not captured in a structured one.
  const textHits = dedupeHits([
    ...scanClinicalText(intake.examinationFindings ?? '', 'examination findings'),
    ...scanClinicalText(intake.pmh ?? '', 'PMH'),
    ...scanClinicalText(intake.surgicalHistory ?? '', 'previous operations'),
    ...scanClinicalText(intake.drugHistory ?? '', 'drug history'),
    ...scanClinicalText(intake.referralNotes ?? '', 'referral notes'),
    ...scanClinicalText(intake.recentInvestigations ?? '', 'recent investigations'),
    ...scanClinicalText(intake.priorColonoscopyFindings ?? '', 'prior colonoscopy findings'),
  ])
  for (const hit of textHits) {
    // Suppress if the structured field already covers it
    if (
      hit.category === 'bowel_surgery_anatomy_change' &&
      intake.priorBowelSurgery &&
      intake.priorBowelSurgery !== 'none'
    ) {
      continue
    }
    if (
      hit.category === 'visible_bleed_source' &&
      (intake.bleedingSourceVisible === 'haemorrhoids' ||
        intake.bleedingSourceVisible === 'fissure' ||
        intake.bleedingSourceVisible === 'other')
    ) {
      continue
    }
    if (
      hit.category === 'anticoagulant' &&
      (intake.onAnticoag === 'yes' || intake.onAntiplatelet === 'yes')
    ) {
      continue
    }
    if (
      hit.category === 'recent_imaging' &&
      intake.priorColonoscopyWithin2y === 'yes'
    ) {
      continue
    }
    warnings.push(`[Free-text scan] ${hit.message}`)
  }

  return {
    ...result,
    investigation,
    algorithmNodeId,
    rationale,
    path,
    warnings,
  }
}
