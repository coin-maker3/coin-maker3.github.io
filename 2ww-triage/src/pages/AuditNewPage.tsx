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
import { generateAuditId, listAuditCases, saveAuditCaseSafe } from '../lib/audit-api'
import { linkTo } from '../lib/router'

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
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    // Generate next ID after fetching the existing list
    listAuditCases()
      .then((cases) => setAuditId(generateAuditId(cases.map((c) => c.id))))
      .catch(() => setAuditId(generateAuditId([])))
  }, [])

  const canSave =
    enteredBy.length >= 2 &&
    clinicMonth.match(/^\d{4}-\d{2}$/) &&
    actualDecision !== ''

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
          actualDecision: actualDecision as Investigation,
          actualDecisionNotes: actualNotes,
          reviewerNotes,
          concordant: decision.investigation === actualDecision,
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
                  <label className="label" htmlFor="auditId">Audit ID</label>
                  <input id="auditId" readOnly className="input" value={auditId} />
                </div>
                <div>
                  <label className="label" htmlFor="enteredBy">Entered by (initials)</label>
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

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
                {error}
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
