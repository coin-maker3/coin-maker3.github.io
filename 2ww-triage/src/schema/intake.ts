import { z } from 'zod'

export const AGE_BANDS = ['<40', '40-49', '50-59', '60-69', '70-79', '80-89', '>=90'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

/**
 * Map a specific age to the Trust algorithm's age band.
 *
 * The algorithm makes routing decisions at the ≥80 and ≥90 thresholds
 * (see engine.ts: `isAge80Plus`, `isAge90Plus`), so the bands MUST honour
 * those cutoffs. Years are inclusive at the lower bound: 80-year-old →
 * '80-89', 90-year-old → '>=90'.
 *
 * Negative or implausibly large values default to '<40' / '>=90' to
 * keep the engine deterministic even on bad input.
 */
export function ageToBand(age: number): AgeBand {
  if (!Number.isFinite(age)) return '60-69'
  if (age < 40) return '<40'
  if (age <= 49) return '40-49'
  if (age <= 59) return '50-59'
  if (age <= 69) return '60-69'
  if (age <= 79) return '70-79'
  if (age <= 89) return '80-89'
  return '>=90'
}

export const SEX = ['F', 'M'] as const
export type Sex = (typeof SEX)[number]

export const REFERRAL_REASONS = [
  'change_in_bowel_habit',
  'rectal_bleeding',
  'iron_deficiency_anaemia',
  'weight_loss',
  'abdominal_mass',
  'rectal_mass',
  'asymptomatic_fit_positive',
  'other',
] as const
export type ReferralReason = (typeof REFERRAL_REASONS)[number]

export const REFERRAL_REASON_LABELS: Record<ReferralReason, string> = {
  change_in_bowel_habit: 'Change in bowel habit',
  rectal_bleeding: 'Rectal bleeding',
  iron_deficiency_anaemia: 'Iron deficiency anaemia',
  weight_loss: 'Unintentional weight loss',
  abdominal_mass: 'Abdominal mass',
  rectal_mass: 'Rectal mass',
  asymptomatic_fit_positive: 'Asymptomatic FIT positive',
  other: 'Other',
}

export const PR_BLEED = ['none', 'bright', 'dark', 'mixed'] as const
export type PRBleed = (typeof PR_BLEED)[number]

/**
 * Visible source of bleeding identified on examination (DRE or proctoscopy).
 * Affects whether the rectal bleeding is "unexplained" for 2WW purposes per
 * NICE NG12 — visible haemorrhoids/fissure may support downgrade to routine.
 */
export const BLEEDING_SOURCE = ['unknown', 'none', 'haemorrhoids', 'fissure', 'other'] as const
export type BleedingSource = (typeof BLEEDING_SOURCE)[number]

export const BLEEDING_SOURCE_LABELS: Record<BleedingSource, string> = {
  unknown: 'Not examined / unknown',
  none: 'No visible source on examination',
  haemorrhoids: 'Visible haemorrhoids',
  fissure: 'Visible fissure',
  other: 'Other visible source',
}

/**
 * Abnormal CT findings the patient came in with — Trust PDF page 1 right side.
 * Different workup pathway from symptom-driven branches.
 */
export const ABNORMAL_CT = ['no', 'colonic_rectal_thickening', 'other'] as const
export type AbnormalCt = (typeof ABNORMAL_CT)[number]

export const ABNORMAL_CT_LABELS: Record<AbnormalCt, string> = {
  no: 'No prior abnormal CT',
  colonic_rectal_thickening: 'Colonic / rectal thickening or colonic pathology',
  other: 'Other abnormal finding (e.g. extra-colonic mass)',
}

/**
 * Prior bowel surgery — affects whether colonoscopy / CTVC make anatomical
 * sense for this patient. Subtotal/total colectomy or APR change everything.
 */
export const PRIOR_BOWEL_SURGERY = [
  'none',
  'partial_colectomy',
  'subtotal_colectomy',
  'total_colectomy_ileostomy',
  'apr',
  'anterior_resection',
  'pouch_reconstruction',
  'other',
] as const
export type PriorBowelSurgery = (typeof PRIOR_BOWEL_SURGERY)[number]

export const PRIOR_BOWEL_SURGERY_LABELS: Record<PriorBowelSurgery, string> = {
  none: 'None',
  partial_colectomy: 'Partial colectomy / hemicolectomy',
  subtotal_colectomy: 'Subtotal colectomy',
  total_colectomy_ileostomy: 'Total colectomy + ileostomy',
  apr: 'Abdominoperineal resection (APR)',
  anterior_resection: 'Anterior resection',
  pouch_reconstruction: 'Ileal pouch–anal anastomosis (pouch)',
  other: 'Other bowel surgery',
}

export const CLINIC_TYPE = ['telephone', 'face_to_face'] as const
export type ClinicType = (typeof CLINIC_TYPE)[number]

export const YN = ['yes', 'no', 'unknown'] as const
export type YesNo = (typeof YN)[number]

const optionalNumber = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
  .pipe(z.number().nullable())

export const IntakeSchema = z.object({
  // -- Clinic meta --
  clinicType: z.enum(CLINIC_TYPE),
  /** Specific age in years. Source of truth — when present the form derives
   *  `ageBand` automatically. Null only until clinician enters a value
   *  (future: auto-fed from EPR patient demographics). */
  age: optionalNumber.nullable().optional(),
  ageBand: z.enum(AGE_BANDS),
  sex: z.enum(SEX),
  whoScore: z.coerce.number().int().min(0).max(4),
  cfs: z.coerce.number().int().min(1).max(9).nullable().optional(),

  // -- Referral --
  referralReasons: z.array(z.enum(REFERRAL_REASONS)).min(1),
  referralNotes: z.string().optional().default(''),

  // -- Bloods (latest) --
  hb: optionalNumber, // g/L
  mcv: optionalNumber, // fL
  ferritin: optionalNumber, // ug/L
  gfr: optionalNumber, // ml/min
  fit: optionalNumber, // ug Hb / g faeces

  // -- Bloods (prior, optional, for trend) --
  hbPrior: optionalNumber,
  ferritinPrior: optionalNumber,

  // -- Symptoms --
  cibh: z.enum(YN),
  cibhDurationWeeks: optionalNumber,
  prBleed: z.enum(PR_BLEED),
  mucusPR: z.enum(YN),
  tenesmus: z.enum(YN),
  weightLoss: z.enum(YN),
  weightLossKg: optionalNumber,
  abdominalPain: z.enum(YN),

  // -- Examination --
  palpableAbdoMass: z.enum(YN),
  palpableRectalMass: z.enum(YN),
  rectalMassLowAndTender: z.enum(YN),
  /** Visible source of bleeding seen at DRE / proctoscopy (haemorrhoids,
   *  fissure, none). Surfaces in engine warnings when bleeding is reported. */
  bleedingSourceVisible: z.enum(BLEEDING_SOURCE).optional().default('unknown'),
  examinationFindings: z.string().optional().default(''),

  // -- History --
  fhxCrcOrIbd: z.enum(YN),
  previousCRC: z.enum(YN),
  ibd: z.enum(YN),
  priorColonoscopyWithin2y: z.enum(YN),
  priorColonoscopyFindings: z.string().optional().default(''),
  /** Prior CTVC within last 2 years — routing exception per PDF page 2
   *  ("Recent (last 2 years) GI investigations (Col/CTVC) → Discuss with COW"). */
  priorCtvcWithin2y: z.enum(YN).optional().default('no'),
  priorCtvcFindings: z.string().optional().default(''),
  recentInvestigations: z.string().optional().default(''),
  /** Prior abnormal CT findings — separate pathway per Trust PDF page 1
   *  right side. Default 'no' (most patients haven't had a CT yet). */
  abnormalCt: z.enum(ABNORMAL_CT).optional().default('no'),
  /** Prior bowel surgery — structured so the engine can warn when a
   *  recommendation (e.g. colonoscopy) doesn't fit the patient's anatomy. */
  priorBowelSurgery: z.enum(PRIOR_BOWEL_SURGERY).optional().default('none'),
  pmh: z.string().optional().default(''),
  surgicalHistory: z.string().optional().default(''),

  // -- Meds --
  onAnticoag: z.enum(YN),
  anticoagDetails: z.string().optional().default(''),
  onAntiplatelet: z.enum(YN),
  antiplateletDetails: z.string().optional().default(''),
  drugHistory: z.string().optional().default(''),
  allergies: z.string().optional().default(''),

  // -- Social / lifestyle --
  smoker: z.enum(YN),
  alcohol: z.enum(YN),

  // -- Female --
  lmp: z.string().optional().default(''),
  pregnant: z.enum(YN).optional(),

  // -- Procedure fitness --
  independentADLs: z.enum(YN),
  mobilityAids: z.enum(YN),
  mobilityAidsDetails: z.string().optional().default(''),
  overnightEscort: z.enum(YN),
  fitForBowelPrep: z.enum(YN),
  fitForSedation: z.enum(YN),

  // -- Consent / info --
  investigationsExplained: z.enum(YN),
  infoGiven: z.enum(YN),

  // -- Workflow --
  lacksCapacity: z.enum(YN).default('no'),
})

export type Intake = z.infer<typeof IntakeSchema>

export const DEFAULT_INTAKE: Intake = {
  clinicType: 'telephone',
  age: null,
  ageBand: '60-69',
  sex: 'F',
  whoScore: 0,
  cfs: null,
  referralReasons: [],
  referralNotes: '',
  hb: null,
  mcv: null,
  ferritin: null,
  gfr: null,
  fit: null,
  hbPrior: null,
  ferritinPrior: null,
  cibh: 'no',
  cibhDurationWeeks: null,
  prBleed: 'none',
  mucusPR: 'no',
  tenesmus: 'no',
  weightLoss: 'no',
  weightLossKg: null,
  abdominalPain: 'no',
  palpableAbdoMass: 'no',
  palpableRectalMass: 'no',
  rectalMassLowAndTender: 'no',
  bleedingSourceVisible: 'unknown',
  examinationFindings: '',
  fhxCrcOrIbd: 'no',
  previousCRC: 'no',
  ibd: 'no',
  priorColonoscopyWithin2y: 'no',
  priorColonoscopyFindings: '',
  priorCtvcWithin2y: 'no',
  priorCtvcFindings: '',
  recentInvestigations: '',
  abnormalCt: 'no',
  priorBowelSurgery: 'none',
  pmh: '',
  surgicalHistory: '',
  onAnticoag: 'no',
  anticoagDetails: '',
  onAntiplatelet: 'no',
  antiplateletDetails: '',
  drugHistory: '',
  allergies: '',
  smoker: 'no',
  alcohol: 'no',
  lmp: '',
  pregnant: 'no',
  independentADLs: 'yes',
  mobilityAids: 'no',
  mobilityAidsDetails: '',
  overnightEscort: 'yes',
  fitForBowelPrep: 'yes',
  fitForSedation: 'yes',
  investigationsExplained: 'no',
  infoGiven: 'no',
  lacksCapacity: 'no',
}
