import { useEffect, useMemo, useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { IntakeForm } from '../components/IntakeForm'
import { DecisionCard } from '../components/DecisionCard'
import { PathViewer } from '../components/PathViewer'
import { ActualOutcomePanel } from '../components/ActualOutcomePanel'
import { decide } from '../algorithm/engine'
import { ALGORITHM_VERSION } from '../algorithm/version'
import { DEFAULT_INTAKE, type Intake } from '../schema/intake'
import type { Investigation } from '../algorithm/types'
import {
  generateAuditId,
  getCohort,
  listAuditCases,
  saveAuditCaseSafe,
} from '../lib/audit-api'
import {
  EXCLUSION_REASONS,
  EXCLUSION_REASON_LABELS,
  type ExclusionReason,
} from '../audit/types'
import { linkTo } from '../lib/router'

const AUDIT_ID_FORMAT = /^[A-Z0-9][A-Z0-9_-]{2,39}$/

const MAX_TIME_TAKEN_SECONDS = 30 * 60 // cap so an abandoned tab doesn't poison the time-per-case stat

const yyyyMm = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function AuditNewPage() {
  const [intake, setIntake] = useState<Intake>(DEFAULT_INTAKE)
  const decision = useMemo(() => decide(intake), [intake])

  const [enteredBy, setEnteredBy] = useState('')
  const [clinicMonth, setClinicMonth] = useState(yyyyMm())
  const [actualDecision, setActualDecision] = useState<Investigation | ''>('')
  const [actualNotes, setActualNotes] = useState('')
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [auditId, setAuditId] = useState<string>('AUDIT-…')
  const [auditIdTouched, setAuditIdTouched] = useState(false)
  const [cohortIds, setCohortIds] = useState<string[]>([])
  const [enteredIds, setEnteredIds] = useState<Set<string>>(new Set())
  const [excluded, setExcluded] = useState(false)
  const [exclusionReason, setExclusionReason] = useState<ExclusionReason | ''>('')
  const [exclusionNotes, setExclusionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    // Load cohort + existing cases for ID generation + cohort hinting
    Promise.all([
      listAuditCases().catch(() => [] as Array<{ id: string }>),
      getCohort().catch(() => ({ ids: [] as string[], updatedAt: '', updatedBy: '' })),
    ]).then(([cases, cohort]) => {
      const enteredSet = new Set(cases.map((c) => c.id))
      setEnteredIds(enteredSet)
      setCohortIds(cohort.ids)
      if (!auditIdTouched) {
        // If a cohort is set, suggest the first pending ID from the cohort.
        // Otherwise fall back to the auto-generated AUDIT-YYYY-NNNN.
        const pending = cohort.ids.find((id) => !enteredSet.has(id))
        if (pending) {
          setAuditId(pending)
        } else {
          setAuditId(generateAuditId(Array.from(enteredSet)))
        }
      }
    })
  }, [auditIdTouched])

  const auditIdValid = AUDIT_ID_FORMAT.test(auditId)
  const auditIdInCohort = cohortIds.length === 0 || cohortIds.includes(auditId)
  const auditIdAlreadyEntered = enteredIds.has(auditId)

  // Core data required to save any case (excluded or not).
  const coreOk =
    enteredBy.length >= 2 &&
    clinicMonth.match(/^\d{4}-\d{2}$/) !== null &&
    auditIdValid &&
    !auditIdAlreadyEntered
  // Non-excluded cases also need age + actual decision; excluded cases only
  // need an exclusion reason.
  const canSave = excluded
    ? coreOk && exclusionReason !== ''
    : coreOk &&
      actualDecision !== '' &&
      intake.age != null &&
      intake.age >= 0 &&
      intake.age <= 120

  const save = async () => {
    if (!canSave || saving) return
    setError(null)
    setSaving(true)
    try {
      const rawSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)
      const timeTakenSeconds = Math.min(rawSeconds, MAX_TIME_TAKEN_SECONDS)
      const { id: finalId } = await saveAuditCaseSafe(
        {
          id: auditId,
          enteredBy: enteredBy.toUpperCase().slice(0, 4),
          clinicMonth,
          intake,
          toolDecision: {
            investigation: decision.investigation,
            nodeId: decision.algorithmNodeId,
            algorithmVersion: ALGORITHM_VERSION.version,
            rationale: decision.rationale,
            path: decision.path,
            warnings: decision.warnings,
          },
          actualDecision: excluded ? ('' as Investigation) : (actualDecision as Investigation),
          actualDecisionNotes: actualNotes,
          reviewerNotes,
          excluded: excluded || undefined,
          exclusionReason: excluded ? (exclusionReason as ExclusionReason) : undefined,
          exclusionNotes: excluded ? exclusionNotes : undefined,
          concordant: !excluded && decision.investigation === actualDecision,
          createdAt: new Date().toISOString(),
          timeTakenSeconds,
        },
        generateAuditId,
      )
      setSaved(finalId)
    } catch (e: any) {
      setError(e.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    const savedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <div className="card border-l-4 border-l-nhs-green">
          <h2 className="text-2xl font-semibold text-nhs-green">✓ Saved</h2>
          <p className="mt-2">
            Audit case <code className="font-mono">{saved}</code> recorded at {savedAt}.
          </p>
          <p className="mt-1 text-xs text-nhs-mid-grey">
            Safe to close this tab. Data persists in Vercel KV (London).
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <a className="btn-primary" href={linkTo.auditNew()} onClick={() => window.location.reload()}>
              Enter next case
            </a>
            <a className="btn-secondary" href={linkTo.audit()}>
              Back to audit list
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-nhs-dark-blue">2WW Audit — new case</h1>
            <p className="text-xs text-nhs-mid-grey">
              George Eliot Hospital · concordance audit · {auditId}
            </p>
          </div>
          <a className="btn-secondary" href={linkTo.audit()}>
            Cancel
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_460px]">
          <div className="space-y-6">
            <section className="card">
              <h2 className="text-lg font-semibold text-nhs-dark-blue">Audit case</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="auditId">
                    Audit ID
                    {cohortIds.length > 0 && (
                      <span className="ml-1 text-[10px] font-normal text-nhs-mid-grey">
                        (cohort of {cohortIds.length} set)
                      </span>
                    )}
                  </label>
                  <input
                    id="auditId"
                    className="input"
                    value={auditId}
                    onChange={(e) => {
                      setAuditIdTouched(true)
                      setAuditId(e.target.value.toUpperCase())
                    }}
                  />
                  {!auditIdValid && (
                    <div className="mt-1 text-[11px] text-red-700">
                      3–40 chars, letters/digits/dash/underscore only
                    </div>
                  )}
                  {auditIdValid && auditIdAlreadyEntered && (
                    <div className="mt-1 text-[11px] text-red-700">This ID has already been entered</div>
                  )}
                  {auditIdValid && !auditIdAlreadyEntered && cohortIds.length > 0 && !auditIdInCohort && (
                    <div className="mt-1 text-[11px] text-amber-700">
                      Not in the current cohort list — proceed only if intentional
                    </div>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="enteredBy">Reviewer initials</label>
                  <input
                    id="enteredBy"
                    className="input"
                    placeholder="e.g. AB"
                    value={enteredBy}
                    onChange={(e) => setEnteredBy(e.target.value)}
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="clinicMonth">Clinic month</label>
                  <input
                    id="clinicMonth"
                    type="month"
                    className="input"
                    value={clinicMonth}
                    onChange={(e) => setClinicMonth(e.target.value)}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-nhs-mid-grey">
                No NHS number, no name, no date of birth, no specific clinic date. Extract symptoms, bloods and exam findings only.
              </p>
            </section>

            {/* Exclusion gate — surfaces first so an excluded case skips full data entry */}
            <section className="card border-l-4 border-l-nhs-mid-grey">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={excluded}
                  onChange={(e) => setExcluded(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-nhs-blue focus:ring-nhs-bright-blue"
                />
                Exclude this case from the concordance analysis
              </label>
              <p className="mt-1 text-xs text-nhs-mid-grey">
                Per AUDIT-PROTOCOL §6. Excluded cases are still recorded (so the
                audit's denominator is transparent) but they don't contribute to
                the primary concordance outcome.
              </p>
              {excluded && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="label" htmlFor="exclusionReason">Exclusion reason</label>
                    <select
                      id="exclusionReason"
                      className="select"
                      value={exclusionReason}
                      onChange={(e) => setExclusionReason(e.target.value as ExclusionReason)}
                    >
                      <option value="">— select —</option>
                      {EXCLUSION_REASONS.map((r) => (
                        <option key={r} value={r}>{EXCLUSION_REASON_LABELS[r]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="exclusionNotes">Exclusion notes (optional, anonymised)</label>
                    <textarea
                      id="exclusionNotes"
                      rows={2}
                      className="input"
                      placeholder="e.g. duplicate of GEH-2WW-014"
                      value={exclusionNotes}
                      onChange={(e) => setExclusionNotes(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                </div>
              )}
            </section>

            {!excluded && (
              <>
                <IntakeForm value={intake} onChange={setIntake} />

                <ActualOutcomePanel
                  toolDecision={decision.investigation}
                  actualDecision={actualDecision}
                  onActualChange={setActualDecision}
                  notes={actualNotes}
                  onNotesChange={setActualNotes}
                  reviewerNotes={reviewerNotes}
                  onReviewerNotesChange={setReviewerNotes}
                />
              </>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}

            {!canSave && (
              <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Required to save:</strong>{' '}
                reviewer initials,
                clinic month,
                patient age,
                and actual clinical decision.
              </div>
            )}

            <button
              type="button"
              className="btn-primary w-full justify-center"
              disabled={!canSave || saving}
              onClick={save}
            >
              <Save className="h-4 w-4" aria-hidden /> {saving ? 'Saving…' : 'Save audit case'}
            </button>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-4 lg:h-fit">
            <DecisionCard decision={decision} />
            <PathViewer decision={decision} />
          </aside>
        </div>
      </main>
    </div>
  )
}
