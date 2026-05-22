import type { Intake } from '../schema/intake'
import type { Investigation } from '../algorithm/types'

export interface AuditCase {
  /** Anonymous audit ID generated at case creation (e.g. AUDIT-2026-0001). */
  id: string
  /** Initials of the FY1 entering this case (audit-only, not PID). */
  enteredBy: string
  /** Approximate date of the original clinic visit (no specific date — month/year only). */
  clinicMonth: string // "YYYY-MM"
  /** All clinician-extracted findings — same schema as the production tool. */
  intake: Intake
  /** What the algorithm recommended for this case. */
  toolDecision: {
    investigation: Investigation
    nodeId: string
    algorithmVersion: string
    rationale: string
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
  return [
    c.clinicMonth,
    i.ageBand,
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

export interface AuditSummary {
  total: number
  concordant: number
  concordancePct: number
  byArm: Array<{
    nodeIdPrefix: string
    label: string
    total: number
    concordant: number
    concordancePct: number
  }>
  mismatchPatterns: Array<{
    toolDecision: Investigation
    actualDecision: Investigation
    count: number
  }>
}

export function buildSummary(cases: AuditCase[]): AuditSummary {
  const total = cases.length
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
  const byArm = Array.from(armGroups.entries()).map(([prefix, list]) => ({
    nodeIdPrefix: prefix,
    label: ARM_LABELS[prefix] ?? prefix,
    total: list.length,
    concordant: list.filter((c) => c.concordant).length,
    concordancePct: list.length ? Math.round((list.filter((c) => c.concordant).length / list.length) * 100) : 0,
  }))

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

  return {
    total,
    concordant,
    concordancePct: total ? Math.round((concordant / total) * 100) : 0,
    byArm: byArm.sort((a, b) => b.total - a.total),
    mismatchPatterns,
  }
}

export function exportCSV(cases: AuditCase[]): string {
  const headers = [
    'id',
    'enteredBy',
    'clinicMonth',
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
    'actualDecision',
    'concordant',
    'actualDecisionNotes',
    'reviewerNotes',
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
      c.actualDecision,
      c.concordant,
      c.actualDecisionNotes,
      c.reviewerNotes,
      c.timeTakenSeconds,
      c.createdAt,
    ]
      .map(escape)
      .join(','),
  )
  return [headers.join(','), ...rows].join('\n')
}
