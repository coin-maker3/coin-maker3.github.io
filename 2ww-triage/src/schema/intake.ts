import { z } from 'zod'

export const AGE_BANDS = ['<40', '40-49', '50-59', '60-69', '70-79', '80-89', '>=90'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

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
  examinationFindings: z.string().optional().default(''),

  // -- History --
  fhxCrcOrIbd: z.enum(YN),
  previousCRC: z.enum(YN),
  ibd: z.enum(YN),
  priorColonoscopyWithin2y: z.enum(YN),
  priorColonoscopyFindings: z.string().optional().default(''),
  recentInvestigations: z.string().optional().default(''),
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
  examinationFindings: '',
  fhxCrcOrIbd: 'no',
  previousCRC: 'no',
  ibd: 'no',
  priorColonoscopyWithin2y: 'no',
  priorColonoscopyFindings: '',
  recentInvestigations: '',
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
