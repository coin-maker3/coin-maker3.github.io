import type { Intake } from '../schema/intake'
import { REFERRAL_REASON_LABELS } from '../schema/intake'
import { INVESTIGATION_LABELS, type DecisionResult } from '../algorithm/types'

const YN_TEXT = { yes: 'Yes', no: 'No', unknown: 'Unknown' } as const

const sectionIfYes = (
  flag: Intake['cibh'],
  question: string,
  detail: string,
): string => {
  if (flag !== 'yes') return `${question} ${YN_TEXT[flag]}\n`
  const trimmed = detail.trim()
  return `${question} Yes${trimmed ? `\nIf yes, please specify: ${trimmed}` : ''}\n`
}

const clinicTypeText = (intake: Intake): string =>
  intake.clinicType === 'telephone'
    ? 'telephone clinic, virtual encounter'
    : 'face to face clinic, in-person encounter'

const yn = (v: Intake['cibh']) => YN_TEXT[v]

/**
 * Generates the clinic letter as a filled version of the Trust 2WW form.
 * All identifiers stay as literal placeholders — copy the output into the
 * Word template, then your hospital system handles patient demographics.
 */
export function buildLetter(intake: Intake, decision: DecisionResult): string {
  const reasons = intake.referralReasons
    .map((r) => REFERRAL_REASON_LABELS[r])
    .join(', ')

  const investigation = INVESTIGATION_LABELS[decision.investigation]

  return [
    `This patient [Patient Name] (DOB [DOB], NHS No [NHS No]) has been referred as a 2-week-wait for suspected colorectal cancer and subsequently reviewed via the ${clinicTypeText(intake)}.`,
    ``,
    `Reason for referral: ${reasons || '[Reason]'}`,
    ``,
    `Outcome and plan from clinic appointment: ${investigation}.`,
    ``,
    `Additional information:`,
    `${decision.rationale}`,
    `Algorithm reference: ${decision.algorithm.id} v${decision.algorithm.version}, node ${decision.algorithmNodeId}.`,
    decision.warnings.length
      ? `Caveats: ${decision.warnings.join(' ')}`
      : '',
    ``,
    `FIT test result: ${intake.fit ?? '—'} ug/g`,
    intake.age != null
      ? `Age: ${intake.age} (band ${intake.ageBand})    Gender: ${intake.sex === 'F' ? 'Female' : 'Male'}`
      : `Age band: ${intake.ageBand}    Gender: ${intake.sex === 'F' ? 'Female' : 'Male'}`,
    `WHO score: ${intake.whoScore}`,
    `Bloods — Hb: ${intake.hb ?? '—'} g/L    Ferritin: ${intake.ferritin ?? '—'} ug/L    MCV: ${intake.mcv ?? '—'} fL    GFR: ${intake.gfr ?? '—'} ml/min`,
    intake.hbPrior != null || intake.ferritinPrior != null
      ? `Prior bloods (for trend) — Hb: ${intake.hbPrior ?? '—'}    Ferritin: ${intake.ferritinPrior ?? '—'}`
      : '',
    ``,
    `Past medical / surgical history: ${intake.pmh || '—'}`,
    intake.priorBowelSurgery && intake.priorBowelSurgery !== 'none'
      ? `Prior bowel surgery: ${intake.priorBowelSurgery}`
      : '',
    intake.surgicalHistory ? `Surgical history: ${intake.surgicalHistory}` : '',
    intake.abnormalCt && intake.abnormalCt !== 'no'
      ? `Abnormal CT findings: ${intake.abnormalCt}`
      : '',
    intake.bleedingSourceVisible && intake.bleedingSourceVisible !== 'unknown' && intake.bleedingSourceVisible !== 'none'
      ? `Visible source of bleeding on examination: ${intake.bleedingSourceVisible}`
      : '',
    `Drug history: ${intake.drugHistory || '—'}`,
    `Anticoagulants: ${yn(intake.onAnticoag)}${intake.anticoagDetails ? ` — ${intake.anticoagDetails}` : ''}`,
    `Antiplatelets: ${yn(intake.onAntiplatelet)}${intake.antiplateletDetails ? ` — ${intake.antiplateletDetails}` : ''}`,
    `Allergies: ${intake.allergies || 'None known'}`,
    ``,
    sectionIfYes(
      intake.cibh,
      'Have you had any change in bowel habit?',
      intake.cibhDurationWeeks != null
        ? `Duration: ${intake.cibhDurationWeeks} weeks.`
        : '',
    ),
    `Have you had any rectal bleeding? ${intake.prBleed === 'none' ? 'No' : `Yes — ${intake.prBleed} blood`}`,
    sectionIfYes(intake.mucusPR, 'Have you experienced any mucus per rectum?', ''),
    sectionIfYes(
      intake.tenesmus,
      'Has there been any tenesmus or incomplete evacuation?',
      '',
    ),
    sectionIfYes(
      intake.weightLoss,
      'Have you experienced any weight loss?',
      intake.weightLossKg != null ? `${intake.weightLossKg} kg.` : '',
    ),
    sectionIfYes(intake.abdominalPain, 'Have you experienced any abdominal pain?', ''),
    sectionIfYes(
      intake.fhxCrcOrIbd,
      'Do you have a history of bowel cancer or inflammatory bowel disease in the family?',
      '',
    ),
    sectionIfYes(
      intake.priorColonoscopyWithin2y,
      'Have you had any recent investigations?',
      [intake.priorColonoscopyFindings, intake.recentInvestigations]
        .filter(Boolean)
        .join('; '),
    ),
    `Do you smoke? ${yn(intake.smoker)}`,
    `Do you consume any alcohol? ${yn(intake.alcohol)}`,
    intake.sex === 'F'
      ? `If female: LMP ${intake.lmp || '—'}. Pregnant: ${yn(intake.pregnant ?? 'no')}`
      : '',
    `Are you independent in your activities of daily living? ${yn(intake.independentADLs)}`,
    `Do you use any mobility aids? ${yn(intake.mobilityAids)}${intake.mobilityAidsDetails ? ` — ${intake.mobilityAidsDetails}` : ''}`,
    `Can someone stay overnight and accompany you home following your procedure? ${yn(intake.overnightEscort)}`,
    `Fit for bowel prep: ${yn(intake.fitForBowelPrep)}    Fit for sedation: ${yn(intake.fitForSedation)}`,
    ``,
    `Examination findings (including DRE for face to face clinics): ${intake.examinationFindings || '—'}`,
    `Palpable abdominal mass: ${yn(intake.palpableAbdoMass)}    Palpable rectal mass: ${yn(intake.palpableRectalMass)}`,
    ``,
    `Have the investigations required been explained to the patient? ${yn(intake.investigationsExplained)}`,
    `Has the patient received all the necessary information? ${yn(intake.infoGiven)}`,
    ``,
    `Yours sincerely,`,
    `[Clinician Name]`,
    `[Clinician Role]`,
    `George Eliot Hospital NHS Trust`,
  ]
    .filter((l) => l !== '')
    .join('\n')
}
