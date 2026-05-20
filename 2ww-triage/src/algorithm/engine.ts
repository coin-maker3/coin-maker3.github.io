import type { AgeBand, Intake } from '../schema/intake'
import type { DecisionResult, Investigation, PathStep } from './types'
import { ALGORITHM_VERSION } from './version'

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
  const path: PathStep[] = [
    {
      nodeId: 'ROOT',
      label: 'Tel/F2F 2WW Investigation Algorithm — entry',
    },
  ]

  // ----- Routing exceptions first (PDF page 2 bottom rows) -----

  if (intake.priorColonoscopyWithin2y === 'yes') {
    path.push({
      nodeId: 'ROUTE.RECENT_INV',
      label: 'Recent (last 2 years) GI investigation',
      evidence: intake.priorColonoscopyFindings || 'Patient reports colonoscopy <2y',
    })
    return make(
      'discuss_with_cow',
      'Recent colonoscopy/CTVC within 2 years. Discuss with clinic consultant or COW before requesting repeat investigation.',
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

  // CTVC + OGD — older or unfit for prep but tolerates limited prep
  if (age80 || notFit) {
    path.push({
      nodeId: 'IDA.ctc_ogd',
      label: 'Previous failed/challenging colonoscopy, >=80 yrs, or comorbid',
      evidence: `age ${intake.ageBand}, fit for prep: ${intake.fitForBowelPrep}`,
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

  if (age80 || notFit) {
    const ctcNote =
      intake.tenesmus === 'yes' || intake.palpableRectalMass === 'yes'
        ? ' (+/- FOS if tenesmus or PR mass)'
        : ''
    path.push({
      nodeId: 'CIBH.fit_pos.ctc',
      label: 'Previous failed/challenging col, >=80, comorbid → CTVC' + ctcNote,
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
      label: 'Elderly or unfit for full prep — CTAP base',
      evidence: `age ${intake.ageBand}, fit for prep: ${intake.fitForBowelPrep}`,
    })
    return make(
      heavyLoss ? 'ctc_plus_ogd' : 'ct_ap',
      `Weight loss in elderly/unfit patient. ${heavyLoss ? 'Heavy weight loss (>3kg) — CTVC + OGD' : 'CT AP per Trust pathway'}.`,
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
