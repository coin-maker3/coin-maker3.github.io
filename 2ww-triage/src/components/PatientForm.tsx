import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { submitPatientForm } from '../lib/api'
import {
  DEFAULT_INTAKE,
  ageToBand,
  type Intake,
} from '../schema/intake'

interface Props {
  initialRef: string | null
}

/**
 * Patient-facing pre-clinic questionnaire. Plain-English wording, mobile-first
 * layout, only the fields the patient can answer for themselves. Bloods,
 * examination findings and procedure-fitness assessment stay with the clinician.
 */
export function PatientForm({ initialRef }: Props) {
  const [ref, setRef] = useState(initialRef ?? '')
  const [state, setState] = useState<Intake>(() => ({
    ...DEFAULT_INTAKE,
    referralReasons: [],
  }))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ ref: string; expiresInHours: number } | null>(null)

  const isFemale = state.sex === 'F'
  const childbearingAge =
    state.age != null ? state.age < 50 : ['<40', '40-49'].includes(state.ageBand)

  const set = <K extends keyof Intake>(k: K, v: Intake[K]) =>
    setState((s) => ({ ...s, [k]: v }))

  const setAge = (newAge: number | null) => {
    if (newAge === null) {
      setState((s) => ({ ...s, age: null }))
    } else {
      setState((s) => ({ ...s, age: newAge, ageBand: ageToBand(newAge) }))
    }
  }

  const submit = async () => {
    setError(null)
    if (!ref || ref.length < 4) {
      setError('Please enter the reference number from your appointment letter or text.')
      return
    }
    setSubmitting(true)
    try {
      const result = await submitPatientForm(ref, {
        ...state,
        // Mark which fields came from the patient so the clinician knows what to validate
        _source: 'patient',
        _submittedAt: new Date().toISOString(),
      })
      setDone({ ref: result.ref, expiresInHours: result.expiresInHours })
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
        <div className="card border-l-4 border-l-nhs-green text-center">
          <Check className="mx-auto h-12 w-12 text-nhs-green" aria-hidden />
          <h2 className="mt-3 text-2xl font-semibold text-nhs-dark-blue">Thank you</h2>
          <p className="mt-2 text-nhs-black">
            Your answers have been sent to the clinic.
          </p>
          <p className="mt-4 text-sm text-nhs-mid-grey">
            Reference: <code className="rounded bg-nhs-pale-grey px-2 py-1">{done.ref}</code>
          </p>
          <p className="mt-2 text-xs text-nhs-mid-grey">
            Please bring your appointment letter to clinic. You don't need to do anything else.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      {/* Test-mode banner */}
      <div className="rounded-lg border-l-4 border-l-nhs-warm-yellow bg-amber-50 p-3 text-sm text-amber-900">
        <strong>Testing mode.</strong> Use only a reference number beginning with{' '}
        <code className="rounded bg-amber-100 px-1">TEST-</code>. Do not enter any real NHS number or patient identifier.
      </div>

      <header className="card">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Pre-clinic questionnaire</h1>
        <p className="mt-1 text-sm text-nhs-dark-grey">
          Please answer these questions before your colorectal clinic appointment. It should take 5 minutes. The doctor will go through your answers with you in clinic.
        </p>
      </header>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-nhs-dark-blue">Reference</h2>
        <label className="label" htmlFor="ref">
          Reference number from your appointment letter or text
        </label>
        <input
          id="ref"
          className="input"
          placeholder="e.g. TEST-AB12-CD34"
          value={ref}
          onChange={(e) => setRef(e.target.value.toUpperCase())}
          autoComplete="off"
          autoCorrect="off"
        />
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-nhs-dark-blue">About you</h2>
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="age">How old are you?</label>
            <input
              id="age"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              className="input"
              placeholder="e.g. 67"
              value={state.age ?? ''}
              onChange={(e) =>
                setAge(e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="sex">Are you male or female?</label>
            <select
              id="sex"
              className="select"
              value={state.sex}
              onChange={(e) => set('sex', e.target.value as Intake['sex'])}
            >
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-nhs-dark-blue">Your symptoms</h2>
        <p className="mb-4 text-xs text-nhs-mid-grey">In the last few weeks…</p>

        <PatientYN
          id="cibh"
          label="Have you noticed any change in how often you go to the toilet — for example going more, less, or differently than usual?"
          value={state.cibh}
          onChange={(v) => set('cibh', v)}
        />
        {state.cibh === 'yes' && (
          <PatientNumber
            id="cibhWeeks"
            label="For how many weeks has this been going on?"
            unit="weeks"
            value={state.cibhDurationWeeks}
            onChange={(n) => set('cibhDurationWeeks', n)}
          />
        )}

        <div className="mt-4">
          <label className="label" htmlFor="bleed">
            Have you noticed any blood when you go to the toilet?
          </label>
          <select
            id="bleed"
            className="select"
            value={state.prBleed}
            onChange={(e) => set('prBleed', e.target.value as Intake['prBleed'])}
          >
            <option value="none">No</option>
            <option value="bright">Yes — bright red blood</option>
            <option value="dark">Yes — dark blood</option>
            <option value="mixed">Yes — mixed in with my poo</option>
          </select>
        </div>

        <PatientYN
          id="mucus"
          label="Have you noticed any mucus or slime in your poo?"
          value={state.mucusPR}
          onChange={(v) => set('mucusPR', v)}
        />

        <PatientYN
          id="tenes"
          label="Have you had a feeling that you haven't completely emptied your bowels even after going to the toilet?"
          value={state.tenesmus}
          onChange={(v) => set('tenesmus', v)}
        />

        <PatientYN
          id="abdo"
          label="Have you had any new or different tummy (abdominal) pain?"
          value={state.abdominalPain}
          onChange={(v) => set('abdominalPain', v)}
        />

        <PatientYN
          id="weight"
          label="Have you lost weight without trying to?"
          value={state.weightLoss}
          onChange={(v) => set('weightLoss', v)}
        />
        {state.weightLoss === 'yes' && (
          <PatientNumber
            id="weightKg"
            label="Roughly how much weight have you lost?"
            unit="kg"
            step="0.5"
            value={state.weightLossKg}
            onChange={(n) => set('weightLossKg', n)}
          />
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-nhs-dark-blue">Family and personal history</h2>

        <PatientYN
          id="fhx"
          label="Has anyone in your immediate family (parent, brother, sister, child) had bowel cancer, Crohn's disease, or ulcerative colitis?"
          value={state.fhxCrcOrIbd}
          onChange={(v) => set('fhxCrcOrIbd', v)}
        />
        <PatientYN
          id="prevCRC"
          label="Have you ever been told you had bowel cancer in the past?"
          value={state.previousCRC}
          onChange={(v) => set('previousCRC', v)}
        />
        <PatientYN
          id="ibd"
          label="Have you ever been told you have Crohn's disease or ulcerative colitis?"
          value={state.ibd}
          onChange={(v) => set('ibd', v)}
        />
        <PatientYN
          id="recentCol"
          label="Have you had a colonoscopy or CT scan of your bowel in the last 2 years?"
          value={state.priorColonoscopyWithin2y}
          onChange={(v) => set('priorColonoscopyWithin2y', v)}
        />
        {state.priorColonoscopyWithin2y === 'yes' && (
          <div className="mt-2">
            <label className="label" htmlFor="colFindings">
              What were you told about the result? (optional)
            </label>
            <textarea
              id="colFindings"
              rows={2}
              className="input"
              value={state.priorColonoscopyFindings}
              onChange={(e) => set('priorColonoscopyFindings', e.target.value)}
            />
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-nhs-dark-blue">Medications and allergies</h2>

        <PatientYN
          id="anticoag"
          label="Do you currently take any blood-thinning tablets? (for example warfarin, apixaban, rivaroxaban, dabigatran, edoxaban)"
          value={state.onAnticoag}
          onChange={(v) => set('onAnticoag', v)}
        />
        {state.onAnticoag === 'yes' && (
          <input
            aria-label="Which anticoagulant"
            placeholder="Which one?"
            className="input mt-2"
            value={state.anticoagDetails}
            onChange={(e) => set('anticoagDetails', e.target.value)}
          />
        )}

        <PatientYN
          id="antiplt"
          label="Do you take aspirin or clopidogrel regularly?"
          value={state.onAntiplatelet}
          onChange={(v) => set('onAntiplatelet', v)}
        />
        {state.onAntiplatelet === 'yes' && (
          <input
            aria-label="Which antiplatelet"
            placeholder="Which one?"
            className="input mt-2"
            value={state.antiplateletDetails}
            onChange={(e) => set('antiplateletDetails', e.target.value)}
          />
        )}

        <div className="mt-3">
          <label className="label" htmlFor="allergy">Do you have any allergies? (optional)</label>
          <input
            id="allergy"
            className="input"
            placeholder="e.g. penicillin, latex"
            value={state.allergies}
            onChange={(e) => set('allergies', e.target.value)}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-nhs-dark-blue">Habits</h2>
        <PatientYN
          id="smoke"
          label="Do you currently smoke?"
          value={state.smoker}
          onChange={(v) => set('smoker', v)}
        />
        <PatientYN
          id="alcohol"
          label="Do you drink alcohol?"
          value={state.alcohol}
          onChange={(v) => set('alcohol', v)}
        />
        {isFemale && childbearingAge && (
          <PatientYN
            id="pregnant"
            label="Could you be pregnant?"
            value={state.pregnant ?? 'no'}
            onChange={(v) => set('pregnant', v)}
          />
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-nhs-dark-blue">For your appointment</h2>
        <PatientYN
          id="indADL"
          label="Are you able to look after yourself day-to-day without help?"
          value={state.independentADLs}
          onChange={(v) => set('independentADLs', v)}
        />
        <PatientYN
          id="mobaid"
          label="Do you use any walking aids (stick, frame, wheelchair)?"
          value={state.mobilityAids}
          onChange={(v) => set('mobilityAids', v)}
        />
        <PatientYN
          id="overnight"
          label="If the doctor recommends a test under sedation, can someone stay with you overnight afterwards?"
          value={state.overnightEscort}
          onChange={(v) => set('overnightEscort', v)}
        />
        <PatientYN
          id="prep"
          label="Could you stop eating for a day and drink bowel-cleaning fluids if needed?"
          value={state.fitForBowelPrep}
          onChange={(v) => set('fitForBowelPrep', v)}
        />
      </section>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <button
        type="button"
        className="btn-primary w-full justify-center text-base"
        disabled={submitting}
        onClick={submit}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
          </>
        ) : (
          'Send my answers to the clinic'
        )}
      </button>

      <p className="text-center text-xs text-nhs-mid-grey">
        Your answers are sent securely to the clinic and deleted after 48 hours during testing.
      </p>
    </div>
  )
}

function PatientYN({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: 'yes' | 'no' | 'unknown'
  onChange: (v: 'yes' | 'no' | 'unknown') => void
}) {
  return (
    <div className="border-b border-gray-100 py-3 last:border-0">
      <label id={`${id}-label`} className="mb-2 block text-sm font-medium text-nhs-black">
        {label}
      </label>
      <div className="toggle-yn" role="group" aria-labelledby={`${id}-label`}>
        <button
          type="button"
          aria-pressed={value === 'yes'}
          onClick={() => onChange('yes')}
        >
          Yes
        </button>
        <button
          type="button"
          aria-pressed={value === 'no'}
          onClick={() => onChange('no')}
        >
          No
        </button>
      </div>
    </div>
  )
}

function PatientNumber({
  id,
  label,
  unit,
  value,
  onChange,
  step,
}: {
  id: string
  label: string
  unit: string
  value: number | null
  onChange: (n: number | null) => void
  step?: string
}) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <label htmlFor={id} className="text-sm text-nhs-dark-grey">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step ?? '1'}
          className="input w-24"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
        <span className="text-sm text-nhs-mid-grey">{unit}</span>
      </div>
    </div>
  )
}
