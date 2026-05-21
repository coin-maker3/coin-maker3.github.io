import { useMemo, useState } from 'react'
import { Copy as CopyIcon } from 'lucide-react'
import { IntakeForm } from '../components/IntakeForm'
import { DecisionCard } from '../components/DecisionCard'
import { LetterPanel } from '../components/LetterPanel'
import { PathViewer } from '../components/PathViewer'
import { PatientImportPanel } from '../components/PatientImportPanel'
import { decide } from '../algorithm/engine'
import { ALGORITHM_VERSION } from '../algorithm/version'
import { DEFAULT_INTAKE, type Intake } from '../schema/intake'
import { generateTestRef } from '../lib/api'
import { linkTo } from '../lib/router'

export function ClinicianPage() {
  const [intake, setIntake] = useState<Intake>(DEFAULT_INTAKE)
  const [importedRef, setImportedRef] = useState<string | null>(null)
  const [importedAt, setImportedAt] = useState<string | null>(null)
  const [generatedRef, setGeneratedRef] = useState<string | null>(null)

  const decision = useMemo(() => decide(intake), [intake])
  const reset = () => {
    setIntake(DEFAULT_INTAKE)
    setImportedRef(null)
    setImportedAt(null)
  }

  const onImport = (data: Partial<Intake>, ref: string, submittedAt: string) => {
    setIntake((current) => ({ ...current, ...data }))
    setImportedRef(ref)
    setImportedAt(submittedAt)
  }

  const generateAndShareRef = () => {
    const ref = generateTestRef()
    setGeneratedRef(ref)
  }

  const patientUrl = generatedRef
    ? `${window.location.origin}${window.location.pathname}${linkTo.patient(generatedRef)}`
    : null

  const copyPatientUrl = async () => {
    if (!patientUrl) return
    try {
      await navigator.clipboard.writeText(patientUrl)
    } catch {}
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-nhs-dark-blue">
              2WW Colorectal Triage Aid
            </h1>
            <p className="text-xs text-nhs-mid-grey">
              George Eliot Hospital · clinician view · testing mode
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-nhs-mid-grey">
            <span>
              Algorithm{' '}
              <code className="rounded bg-nhs-pale-grey px-1.5 py-0.5">
                {ALGORITHM_VERSION.id} v{ALGORITHM_VERSION.version}
              </code>
            </span>
            <a className="btn-secondary" href={linkTo.audit()}>
              Audit
            </a>
            <button type="button" className="btn-secondary" onClick={reset}>
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_460px]">
          <div className="space-y-6">
            <PatientImportPanel onImport={onImport} />

            {/* Issue patient pre-clinic form (test mode) */}
            <div className="card border-l-4 border-l-nhs-light-blue">
              <h3 className="text-sm font-semibold text-nhs-dark-blue">
                Issue patient pre-clinic form
              </h3>
              <p className="mt-0.5 text-xs text-nhs-mid-grey">
                Generates a test reference number. Share the link with the patient — they fill the form on their phone, and you import the answers above.
              </p>
              {!generatedRef ? (
                <button type="button" className="btn-secondary mt-2" onClick={generateAndShareRef}>
                  Generate reference
                </button>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Reference:</span>
                    <code className="rounded bg-nhs-pale-grey px-2 py-1">{generatedRef}</code>
                  </div>
                  <div className="break-all rounded bg-nhs-pale-grey p-2 text-xs">
                    {patientUrl}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary" onClick={copyPatientUrl}>
                      <CopyIcon className="h-4 w-4" aria-hidden /> Copy link
                    </button>
                    <a
                      className="btn-secondary"
                      href={patientUrl ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in new tab
                    </a>
                  </div>
                </div>
              )}
            </div>

            {importedRef && (
              <div className="rounded-md border-l-4 border-l-nhs-green bg-green-50 p-3 text-sm text-green-900">
                <strong>Patient pre-clinic submission imported.</strong> Ref{' '}
                <code className="rounded bg-green-100 px-1">{importedRef}</code>
                {importedAt && ` · submitted ${new Date(importedAt).toLocaleString('en-GB')}`}
                . Validate the imported answers with the patient, then add bloods,
                exam findings, and procedure fitness.
              </div>
            )}

            <IntakeForm value={intake} onChange={setIntake} />
          </div>
          <aside className="space-y-6 lg:sticky lg:top-4 lg:h-fit">
            <DecisionCard decision={decision} />
            <PathViewer decision={decision} />
            <LetterPanel intake={intake} decision={decision} />
          </aside>
        </div>

        <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-nhs-mid-grey">
          <p>
            Decision support only. Clinical judgement always overrides. Patient submissions are stored for 48 hours during testing only and are not patient-identifiable.
          </p>
        </footer>
      </main>
    </div>
  )
}
