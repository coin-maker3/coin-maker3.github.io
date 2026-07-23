import { useState } from 'react'
import { CheckCircle2, Loader2, UserCheck } from 'lucide-react'
import { retrievePatientForm } from '../lib/api'
import { type Intake } from '../schema/intake'

interface Props {
  onImport: (data: Partial<Intake>, ref: string, submittedAt: string) => void
}

const PATIENT_OWNED_FIELDS: Array<keyof Intake> = [
  'ageBand',
  'sex',
  'cibh',
  'cibhDurationWeeks',
  'prBleed',
  'mucusPR',
  'tenesmus',
  'abdominalPain',
  'weightLoss',
  'weightLossKg',
  'fhxCrcOrIbd',
  'previousCRC',
  'ibd',
  'priorColonoscopyWithin2y',
  'priorColonoscopyFindings',
  'onAnticoag',
  'anticoagDetails',
  'onAntiplatelet',
  'antiplateletDetails',
  'allergies',
  'smoker',
  'alcohol',
  'pregnant',
  'independentADLs',
  'mobilityAids',
  'overnightEscort',
  'fitForBowelPrep',
]

export function PatientImportPanel({ onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [ref, setRef] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imported, setImported] = useState<{ ref: string; at: string } | null>(null)

  const doImport = async () => {
    if (!ref) return
    setLoading(true)
    setError(null)
    try {
      const res = await retrievePatientForm(ref.trim().toUpperCase())
      const payload = res.payload as Record<string, unknown>
      // Pick only the fields the patient owned to avoid stomping clinician-entered ones
      const filtered: Partial<Intake> = {}
      for (const k of PATIENT_OWNED_FIELDS) {
        if (k in payload) (filtered as any)[k] = payload[k]
      }
      onImport(filtered, res.ref, res.submittedAt)
      setImported({ ref: res.ref, at: res.submittedAt })
    } catch (e: any) {
      setError(e.message ?? 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card border-l-4 border-l-nhs-aqua-blue">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-nhs-dark-blue">
            <UserCheck className="mr-1 inline h-4 w-4" aria-hidden /> Patient pre-clinic submission
          </h3>
          <p className="mt-0.5 text-xs text-nhs-mid-grey">
            If the patient filled the pre-clinic form, import their answers by reference.
          </p>
        </div>
        {!open && (
          <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
            Import…
          </button>
        )}
      </div>

      {open && !imported && (
        <div className="mt-3 space-y-2">
          <label htmlFor="patient-ref" className="label">Reference number</label>
          <div className="flex gap-2">
            <input
              id="patient-ref"
              className="input flex-1"
              placeholder="e.g. TEST-AB12-CD34"
              value={ref}
              onChange={(e) => setRef(e.target.value.toUpperCase())}
              autoComplete="off"
            />
            <button
              type="button"
              className="btn-primary"
              onClick={doImport}
              disabled={loading || ref.length < 4}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Look up'}
            </button>
          </div>
          {error && (
            <p className="rounded bg-red-50 p-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {imported && (
        <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-900">
          <CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden />
          Imported submission for <code className="rounded bg-green-100 px-1">{imported.ref}</code>
          <div className="mt-0.5 text-xs">
            Submitted {new Date(imported.at).toLocaleString('en-GB')}. Validate the highlighted fields with the patient before deciding.
          </div>
        </div>
      )}
    </div>
  )
}
