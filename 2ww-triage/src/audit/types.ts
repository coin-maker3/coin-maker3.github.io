import type { Intake } from '../schema/intake'
import type { Investigation, PathStep } from '../algorithm/types'

/** Pre-specified exclusion reasons per AUDIT-PROTOCOL.md §6. */
export const EXCLUSION_REASONS = [
  'dna', // Did not attend
  'discharged_before_assessment',
  'direct_to_mdt', // obvious cancer routed straight to MDT, no investigation pathway choice
  'withdrew_consent',
  'duplicate_referral',
  'other',
] as const
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number]

export const EXCLUSION_REASON_LABELS: Record<ExclusionReason, string> = {
  dna: 'Did not attend',
  discharged_before_assessment: 'Discharged before assessment',
  direct_to_mdt: 'Obvious cancer — direct to MDT (no pathway choice applied)',
  withdrew_consent: 'Withdrew consent / refused investigation',
  duplicate_referral: 'Duplicate referral',
  other: 'Other (specify in notes)',
}

export interface AuditCase {
  /** Anonymous audit ID (auto AUDIT-YYYY-NNNN or user-supplied e.g. GEH-2WW-001). */
  id: string
  /** Initials of the FY1 entering this case (audit-only, not PID). */
  enteredBy: string
  /** Approximate date of the original clinic visit (no specific date — month/year only). */
  clinicMonth: string // "YYYY-MM"
  /**
   * Excluded from concordance denominator per protocol §6 (DNA, direct-to-MDT,
   * withdrew, etc). Excluded cases are still SAVED so the denominator is
   * transparent in the audit report, but they don't contribute to the
   * primary outcome.
   */
  excluded?: boolean
  /** Required when excluded=true. */
  exclusionReason?: ExclusionReason
  /** Free-text detail on the exclusion (e.g. "duplicate of GEH-2WW-014"). */
  exclusionNotes?: string
  /** All clinician-extracted findings — same schema as the production tool. */
  intake: Intake
  /** What the algorithm recommended for this case. */
  toolDecision: {
    investigation: Investigation
    nodeId: string
    algorithmVersion: string
    rationale: string
    /**
     * Full algorithm traversal from root to leaf. Stamped server-side so
     * the audit can show *exactly* how each recommendation was reached
     * weeks later, with every branch + the data that drove it.
     */
    path: PathStep[]
    /** Warnings the engine surfaced (e.g. "no ferritin recorded — chase"). */
    warnings: string[]
  }
  /** What was actually documented in the clinic letter outcome. */
  actualDecision: Investigation
  /** Optional free-text — e.g. "patient declined", "consultant override for FHx" */
  actualDecisionNotes: string
  /** Reviewer's free-text on why the two might differ (mostly used for mismatches). */
  reviewerNotes: string
  /** Auto-computed: does toolDecision === actualDecision? */
  concordant: boolean
  /** ISO timestamps. */
  createdAt: string
  /** Seconds taken to enter the case (for time-per-case secondary outcome). */
  timeTakenSeconds: number | null
}

/**
 * Possible-duplicate detection.
 *
 * Because the audit collects no PID by design, the tool cannot recognise
 * that two FY1s have extracted the same clinic letter. But two records
 * that share clinic month, demographics, referral reasons, banded bloods
 * and core symptoms are highly suspicious — surface them so the audit
 * lead can resolve before analysis.
 *
 * Buckets are deliberately wide (Hb ±5, ferritin ±5, FIT ±10) so that
 * trivial transcription differences (e.g. one FY1 wrote 95 g/L, another
 * wrote 96 g/L) still cluster.
 */
const bucket = (v: number | null | undefined, step: number): string =>
  v == null ? 'n' : String(Math.round(v / step) * step)

function dupSignature(c: AuditCase): string {
  const i = c.intake
  // Use specific age if present, else fall back to band (for backwards-compat
  // with cases entered before the age field existed).
  const ageKey = i.age != null ? `a${i.age}` : `b${i.ageBand}`
  return [
    c.clinicMonth,
    ageKey,
    i.sex,
    [...i.referralReasons].sort().join('+'),
    bucket(i.hb, 5),
    bucket(i.mcv, 5),
    bucket(i.ferritin, 5),
    bucket(i.fit, 10),
    i.cibh,
    i.prBleed,
    i.weightLoss,
    i.palpableAbdoMass,
    i.palpableRectalMass,
  ].join('|')
}

export interface DuplicateGroup {
  signature: string
  cases: AuditCase[]
  crossFy1: boolean
}

export function findPossibleDuplicates(cases: AuditCase[]): DuplicateGroup[] {
  const groups = new Map<string, AuditCase[]>()
  for (const c of cases) {
    const sig = dupSignature(c)
    groups.set(sig, [...(groups.get(sig) ?? []), c])
  }
  return Array.from(groups.entries())
    .filter(([, list]) => list.length >= 2)
    .map(([signature, list]) => ({
      signature,
      cases: list.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      crossFy1: new Set(list.map((c) => c.enteredBy)).size > 1,
    }))
}

export function duplicateIdSet(groups: DuplicateGroup[]): Set<string> {
  const s = new Set<string>()
  for (const g of groups) for (const c of g.cases) s.add(c.id)
  return s
}

/**
 * Wilson score 95% CI for a binomial proportion. Robust at small N, which
 * matters when an audit arm only has a handful of cases.
 */
export function wilson95(numerator: number, denominator: number): { lo: number; hi: number } {
  if (denominator === 0) return { lo: 0, hi: 0 }
  const z = 1.959963984540054 // 97.5th percentile of N(0,1) — two-sided 95%
  const p = numerator / denominator
  const n = denominator
  const denom = 1 + (z * z) / n
  const centre = p + (z * z) / (2 * n)
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)
  return {
    lo: Math.max(0, (centre - margin) / denom),
    hi: Math.min(1, (centre + margin) / denom),
  }
}

/**
 * Cohen's kappa for two raters on a multi-class outcome.
 *
 * Treats the algorithm as rater A and the clinic-documented decision as
 * rater B. Returns kappa with a Wald 95% CI based on Fleiss-Cohen-Everitt
 * standard error (sufficient for the audit's primary inter-rater stat).
 */
export function cohenKappa(cases: AuditCase[]): {
  kappa: number
  ciLo: number
  ciHi: number
  n: number
} | null {
  const n = cases.length
  if (n === 0) return null

  const categories = new Set<string>()
  for (const c of cases) {
    categories.add(c.toolDecision.investigation)
    categories.add(c.actualDecision)
  }
  const cats = Array.from(categories)
  if (cats.length === 0) return null

  let agree = 0
  const rowTotals = new Map<string, number>()
  const colTotals = new Map<string, number>()
  for (const c of cases) {
    if (c.toolDecision.investigation === c.actualDecision) agree++
    rowTotals.set(
      c.toolDecision.investigation,
      (rowTotals.get(c.toolDecision.investigation) ?? 0) + 1,
    )
    colTotals.set(
      c.actualDecision,
      (colTotals.get(c.actualDecision) ?? 0) + 1,
    )
  }
  const Po = agree / n
  let Pe = 0
  for (const cat of cats) {
    Pe += ((rowTotals.get(cat) ?? 0) / n) * ((colTotals.get(cat) ?? 0) / n)
  }
  if (Pe >= 1) return { kappa: 1, ciLo: 1, ciHi: 1, n }
  const kappa = (Po - Pe) / (1 - Pe)
  // SE under H1 (Fleiss simplified) — robust enough at audit N
  const se = Math.sqrt((Po * (1 - Po)) / (n * (1 - Pe) * (1 - Pe)))
  const z = 1.959963984540054
  return {
    kappa,
    ciLo: kappa - z * se,
    ciHi: kappa + z * se,
    n,
  }
}

/** Quantile from a sorted ascending array. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo])
}

export interface AuditSummary {
  /** Total cases in store (including excluded). */
  total: number
  /** Cases excluded from concordance analysis. */
  excluded: number
  /** Cases counted in the primary outcome (total − excluded). */
  analysed: number
  /** Breakdown of exclusion reasons (denominator transparency for audit report). */
  exclusionBreakdown: Array<{ reason: ExclusionReason; label: string; count: number }>
  concordant: number
  concordancePct: number
  /** Wilson 95% CI on overall concordance proportion, 0..1. */
  ci95: { lo: number; hi: number }
  byArm: Array<{
    nodeIdPrefix: string
    label: string
    total: number
    concordant: number
    concordancePct: number
    ci95: { lo: number; hi: number }
  }>
  mismatchPatterns: Array<{
    toolDecision: Investigation
    actualDecision: Investigation
    count: number
  }>
  /** Full confusion matrix: rows = tool decision, cols = actual decision. */
  confusion: {
    rowLabels: Investigation[]
    colLabels: Investigation[]
    /** Indexed by `${row}|${col}` → count. */
    cells: Record<string, number>
    rowTotals: Record<string, number>
    colTotals: Record<string, number>
  }
  /** Cohen's kappa for tool-vs-clinic agreement, with 95% CI. */
  kappa: ReturnType<typeof cohenKappa>
  /** Time per case (seconds): n, mean, IQR (q1, median, q3). */
  timeStats: { n: number; mean: number; q1: number; median: number; q3: number } | null
  /** Per-FY1 progress: how many cases each initials have entered. */
  byFy1: Array<{ enteredBy: string; total: number; concordant: number; concordancePct: number }>
  /** Pre-specified subgroup analyses from protocol §10. */
  subgroups: {
    byReferralReason: Array<{ label: string; total: number; concordant: number; concordancePct: number; ci95: { lo: number; hi: number } }>
    byAgeBand: Array<{ label: string; total: number; concordant: number; concordancePct: number; ci95: { lo: number; hi: number } }>
    byBowelPrepFit: Array<{ label: string; total: number; concordant: number; concordancePct: number; ci95: { lo: number; hi: number } }>
  }
  /** Stop criteria per protocol §17. */
  stopCriteria: {
    overallTriggered: boolean
    overallReason: string | null
    armsTriggered: Array<{ label: string; total: number; concordancePct: number }>
  }
}

function subgroupStat(label: string, list: AuditCase[]) {
  const total = list.length
  const concordant = list.filter((c) => c.concordant).length
  return {
    label,
    total,
    concordant,
    concordancePct: total ? Math.round((concordant / total) * 100) : 0,
    ci95: wilson95(concordant, total),
  }
}

export function buildSummary(allCases: AuditCase[]): AuditSummary {
  // Split excluded from analysed. All downstream stats (concordance, arms,
  // kappa, confusion, subgroups, stop criteria) compute over `cases`
  // (= analysed only) so excluded cases don't poison the denominator.
  const excludedCases = allCases.filter((c) => c.excluded === true)
  const cases = allCases.filter((c) => c.excluded !== true)
  const total = cases.length
  const excluded = excludedCases.length
  const analysed = total
  const exclusionCounts = new Map<ExclusionReason, number>()
  for (const c of excludedCases) {
    const r = c.exclusionReason ?? 'other'
    exclusionCounts.set(r, (exclusionCounts.get(r) ?? 0) + 1)
  }
  const exclusionBreakdown = Array.from(exclusionCounts.entries()).map(
    ([reason, count]) => ({ reason, label: EXCLUSION_REASON_LABELS[reason] ?? reason, count }),
  )
  const concordant = cases.filter((c) => c.concordant).length

  // Group by algorithm arm (first segment of nodeId)
  const armGroups = new Map<string, AuditCase[]>()
  for (const c of cases) {
    const prefix = c.toolDecision.nodeId.split('.')[0]
    armGroups.set(prefix, [...(armGroups.get(prefix) ?? []), c])
  }
  const ARM_LABELS: Record<string, string> = {
    IDA: 'IDA branch',
    MASS: 'Mass branch',
    CIBH: 'CIBH / Rectal bleeding',
    ASYMPT: 'Asymptomatic FIT+',
    WTLOSS: 'Weight loss',
    ROUTE: 'Routing exception',
    ROOT: 'Other',
  }
  const byArm = Array.from(armGroups.entries()).map(([prefix, list]) => {
    const armConcordant = list.filter((c) => c.concordant).length
    return {
      nodeIdPrefix: prefix,
      label: ARM_LABELS[prefix] ?? prefix,
      total: list.length,
      concordant: armConcordant,
      concordancePct: list.length ? Math.round((armConcordant / list.length) * 100) : 0,
      ci95: wilson95(armConcordant, list.length),
    }
  })

  // Mismatch patterns
  const mismatchKey = new Map<string, { toolDecision: Investigation; actualDecision: Investigation; count: number }>()
  for (const c of cases.filter((x) => !x.concordant)) {
    const key = `${c.toolDecision.investigation}→${c.actualDecision}`
    const ex = mismatchKey.get(key)
    if (ex) ex.count++
    else
      mismatchKey.set(key, {
        toolDecision: c.toolDecision.investigation,
        actualDecision: c.actualDecision,
        count: 1,
      })
  }
  const mismatchPatterns = Array.from(mismatchKey.values()).sort((a, b) => b.count - a.count)

  // Full confusion matrix
  const rowSet = new Set<Investigation>()
  const colSet = new Set<Investigation>()
  const cells: Record<string, number> = {}
  const rowTotals: Record<string, number> = {}
  const colTotals: Record<string, number> = {}
  for (const c of cases) {
    const r = c.toolDecision.investigation
    const k = c.actualDecision
    rowSet.add(r)
    colSet.add(k)
    cells[`${r}|${k}`] = (cells[`${r}|${k}`] ?? 0) + 1
    rowTotals[r] = (rowTotals[r] ?? 0) + 1
    colTotals[k] = (colTotals[k] ?? 0) + 1
  }
  const confusion = {
    rowLabels: Array.from(rowSet),
    colLabels: Array.from(colSet),
    cells,
    rowTotals,
    colTotals,
  }

  // Cohen's kappa
  const kappa = cohenKappa(cases)

  // Time stats
  const times = cases
    .map((c) => c.timeTakenSeconds)
    .filter((t): t is number => t != null && t > 0)
    .sort((a, b) => a - b)
  const timeStats =
    times.length > 0
      ? {
          n: times.length,
          mean: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
          q1: Math.round(quantile(times, 0.25)),
          median: Math.round(quantile(times, 0.5)),
          q3: Math.round(quantile(times, 0.75)),
        }
      : null

  // Per-FY1 progress
  const fy1Groups = new Map<string, AuditCase[]>()
  for (const c of cases) {
    const k = c.enteredBy || '?'
    fy1Groups.set(k, [...(fy1Groups.get(k) ?? []), c])
  }
  const byFy1 = Array.from(fy1Groups.entries())
    .map(([enteredBy, list]) => ({
      enteredBy,
      total: list.length,
      concordant: list.filter((c) => c.concordant).length,
      concordancePct: list.length
        ? Math.round((list.filter((c) => c.concordant).length / list.length) * 100)
        : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // Subgroups per protocol §10
  // 1. By referral reason (each reason is counted in every case that lists it)
  const reasonGroups = new Map<string, AuditCase[]>()
  for (const c of cases) {
    for (const r of c.intake.referralReasons ?? []) {
      reasonGroups.set(r, [...(reasonGroups.get(r) ?? []), c])
    }
  }
  const REASON_LABELS: Record<string, string> = {
    change_in_bowel_habit: 'CIBH',
    rectal_bleeding: 'Rectal bleeding',
    iron_deficiency_anaemia: 'IDA',
    weight_loss: 'Weight loss',
    abdominal_mass: 'Abdominal mass',
    rectal_mass: 'Rectal mass',
    asymptomatic_fit_positive: 'Asymptomatic FIT+',
    other: 'Other',
  }
  const byReferralReason = Array.from(reasonGroups.entries())
    .map(([reason, list]) => subgroupStat(REASON_LABELS[reason] ?? reason, list))
    .sort((a, b) => b.total - a.total)

  // 2. By age band per protocol § 10
  const ageBuckets: Array<{ label: string; match: (a: string) => boolean }> = [
    { label: '<60', match: (a) => ['<40', '40-49', '50-59'].includes(a) },
    { label: '60–79', match: (a) => ['60-69', '70-79'].includes(a) },
    { label: '≥80', match: (a) => ['80-89', '>=90'].includes(a) },
  ]
  const byAgeBand = ageBuckets.map((b) =>
    subgroupStat(b.label, cases.filter((c) => b.match(c.intake.ageBand))),
  )

  // 3. By bowel-prep fitness
  const byBowelPrepFit = [
    subgroupStat('Fit for prep — yes', cases.filter((c) => c.intake.fitForBowelPrep === 'yes')),
    subgroupStat('Fit for prep — no', cases.filter((c) => c.intake.fitForBowelPrep === 'no')),
    subgroupStat('Fit for prep — unknown', cases.filter((c) => c.intake.fitForBowelPrep === 'unknown')),
  ].filter((s) => s.total > 0)

  // Stop criteria per protocol § 17
  const overallTriggered =
    total >= 25 && total > 0 && concordant / total < 0.6
  const armsTriggered = byArm
    .filter((a) => a.total >= 5 && a.concordancePct < 50)
    .map((a) => ({ label: a.label, total: a.total, concordancePct: a.concordancePct }))
  const stopCriteria = {
    overallTriggered,
    overallReason: overallTriggered
      ? `Overall concordance ${Math.round((concordant / total) * 100)}% < 60% threshold at N=${total}`
      : null,
    armsTriggered,
  }

  return {
    total: allCases.length,
    excluded,
    analysed,
    exclusionBreakdown,
    concordant,
    concordancePct: total ? Math.round((concordant / total) * 100) : 0,
    ci95: wilson95(concordant, total),
    byArm: byArm.sort((a, b) => b.total - a.total),
    mismatchPatterns,
    confusion,
    kappa,
    timeStats,
    byFy1,
    subgroups: { byReferralReason, byAgeBand, byBowelPrepFit },
    stopCriteria,
  }
}

export function exportCSV(cases: AuditCase[]): string {
  const headers = [
    'id',
    'enteredBy',
    'clinicMonth',
    'age',
    'ageBand',
    'sex',
    'whoScore',
    'referralReasons',
    'hb',
    'mcv',
    'ferritin',
    'fit',
    'cibh',
    'prBleed',
    'tenesmus',
    'weightLoss',
    'palpableAbdoMass',
    'palpableRectalMass',
    'fhxCrcOrIbd',
    'priorColonoscopyWithin2y',
    'fitForBowelPrep',
    'toolDecision',
    'toolNodeId',
    'algorithmVersion',
    'toolPath',
    'toolWarnings',
    'actualDecision',
    'concordant',
    'actualDecisionNotes',
    'reviewerNotes',
    'excluded',
    'exclusionReason',
    'exclusionNotes',
    'timeTakenSeconds',
    'createdAt',
  ]
  const escape = (v: unknown): string => {
    if (v == null) return ''
    const s = Array.isArray(v) ? v.join('|') : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = cases.map((c) =>
    [
      c.id,
      c.enteredBy,
      c.clinicMonth,
      c.intake.age,
      c.intake.ageBand,
      c.intake.sex,
      c.intake.whoScore,
      c.intake.referralReasons,
      c.intake.hb,
      c.intake.mcv,
      c.intake.ferritin,
      c.intake.fit,
      c.intake.cibh,
      c.intake.prBleed,
      c.intake.tenesmus,
      c.intake.weightLoss,
      c.intake.palpableAbdoMass,
      c.intake.palpableRectalMass,
      c.intake.fhxCrcOrIbd,
      c.intake.priorColonoscopyWithin2y,
      c.intake.fitForBowelPrep,
      c.toolDecision.investigation,
      c.toolDecision.nodeId,
      c.toolDecision.algorithmVersion,
      (c.toolDecision.path ?? []).map((p) => `${p.nodeId}:${p.label}`).join(' > '),
      (c.toolDecision.warnings ?? []).join(' | '),
      c.actualDecision,
      c.concordant,
      c.actualDecisionNotes,
      c.reviewerNotes,
      c.excluded ? 'yes' : 'no',
      c.exclusionReason ?? '',
      c.exclusionNotes ?? '',
      c.timeTakenSeconds,
      c.createdAt,
    ]
      .map(escape)
      .join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}
