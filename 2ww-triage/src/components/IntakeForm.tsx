import {
  AGE_BANDS,
  CLINIC_TYPE,
  PR_BLEED,
  REFERRAL_REASONS,
  REFERRAL_REASON_LABELS,
  SEX,
  type Intake,
} from '../schema/intake'
import { YesNoToggle } from './YesNo'

interface Props {
  value: Intake
  onChange: (next: Intake) => void
}

type K = keyof Intake

export function IntakeForm({ value, onChange }: Props) {
  const set = <Key extends K>(k: Key, v: Intake[Key]) =>
    onChange({ ...value, [k]: v })

  const toggleReason = (reason: (typeof REFERRAL_REASONS)[number]) => {
    const current = value.referralReasons
    const next = current.includes(reason)
      ? current.filter((r) => r !== reason)
      : [...current, reason]
    onChange({ ...value, referralReasons: next })
  }

  const isFemale = value.sex === 'F'
  const childbearingAge = ['<40', '40-49'].includes(value.ageBand)

  return (
    <div className="space-y-6">
      {/* Clinic & patient meta */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-nhs-dark-blue">
          Clinic & patient
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="clinicType">Clinic type</label>
            <select
              id="clinicType"
              className="select"
              value={value.clinicType}
              onChange={(e) => set('clinicType', e.target.value as Intake['clinicType'])}
            >
              {CLINIC_TYPE.map((c) => (
                <option key={c} value={c}>
                  {c === 'telephone' ? 'Telephone' : 'Face to face'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ageBand">Age band</label>
            <select
              id="ageBand"
              className="select"
              value={value.ageBand}
              onChange={(e) => set('ageBand', e.target.value as Intake['ageBand'])}
            >
              {AGE_BANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sex">Sex</label>
            <select
              id="sex"
              className="select"
              value={value.sex}
              onChange={(e) => set('sex', e.target.value as Intake['sex'])}
            >
              {SEX.map((s) => (
                <option key={s} value={s}>{s === 'F' ? 'Female' : 'Male'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="who">WHO performance status (0–4)</label>
            <input
              id="who"
              type="number"
              min={0}
              max={4}
              className="input"
              value={value.whoScore}
              onChange={(e) => set('whoScore', Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      {/* Referral */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-nhs-dark-blue">Referral reason</h2>
        <fieldset>
          <legend className="label">Select all that apply</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {REFERRAL_REASONS.map((r) => (
              <label key={r} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value.referralReasons.includes(r)}
                  onChange={() => toggleReason(r)}
                  className="h-4 w-4 rounded border-gray-300 text-nhs-blue focus:ring-nhs-bright-blue"
                />
                {REFERRAL_REASON_LABELS[r]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4">
          <label className="label" htmlFor="referralNotes">Referral notes (anonymised)</label>
          <textarea
            id="referralNotes"
            rows={3}
            className="input"
            placeholder="Strip name/DOB/NHS no. before pasting. Symptoms, PMH, drugs only."
            value={value.referralNotes}
            onChange={(e) => set('referralNotes', e.target.value)}
          />
        </div>
      </section>

      {/* Bloods */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">Bloods</h2>
        <p className="mb-4 text-xs text-nhs-mid-grey">
          Bloods within last 3 months (per Trust IDA criteria).
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <NumberField id="hb" label="Hb (g/L)" v={value.hb} onChange={(n) => set('hb', n)} />
          <NumberField id="mcv" label="MCV (fL)" v={value.mcv} onChange={(n) => set('mcv', n)} />
          <NumberField id="ferritin" label="Ferritin (µg/L)" v={value.ferritin} onChange={(n) => set('ferritin', n)} />
          <NumberField id="gfr" label="GFR (ml/min)" v={value.gfr} onChange={(n) => set('gfr', n)} />
          <NumberField id="fit" label="FIT (µg Hb/g)" v={value.fit} onChange={(n) => set('fit', n)} step="0.1" />
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-nhs-blue">
            Prior values for trend (optional)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <NumberField id="hbPrior" label="Hb prior" v={value.hbPrior} onChange={(n) => set('hbPrior', n)} />
            <NumberField id="ferritinPrior" label="Ferritin prior" v={value.ferritinPrior} onChange={(n) => set('ferritinPrior', n)} />
          </div>
        </details>
      </section>

      {/* Symptoms */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-nhs-dark-blue">Symptoms</h2>
        <div className="space-y-3">
          <Row label="Change in bowel habit">
            <YesNoToggle value={value.cibh} onChange={(v) => set('cibh', v)} />
            {value.cibh === 'yes' && (
              <NumberField
                id="cibhDuration"
                label="Duration (weeks)"
                v={value.cibhDurationWeeks}
                onChange={(n) => set('cibhDurationWeeks', n)}
                inline
              />
            )}
          </Row>

          <Row label="Rectal bleeding">
            <select
              className="select w-40"
              value={value.prBleed}
              onChange={(e) => set('prBleed', e.target.value as Intake['prBleed'])}
            >
              {PR_BLEED.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Row>

          <Row label="Mucus PR">
            <YesNoToggle value={value.mucusPR} onChange={(v) => set('mucusPR', v)} />
          </Row>

          <Row label="Tenesmus / incomplete evacuation">
            <YesNoToggle value={value.tenesmus} onChange={(v) => set('tenesmus', v)} />
          </Row>

          <Row label="Unintentional weight loss">
            <YesNoToggle value={value.weightLoss} onChange={(v) => set('weightLoss', v)} />
            {value.weightLoss === 'yes' && (
              <NumberField
                id="wtLoss"
                label="kg"
                v={value.weightLossKg}
                onChange={(n) => set('weightLossKg', n)}
                inline
                step="0.1"
              />
            )}
          </Row>

          <Row label="Abdominal pain">
            <YesNoToggle value={value.abdominalPain} onChange={(v) => set('abdominalPain', v)} />
          </Row>
        </div>
      </section>

      {/* Examination */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-nhs-dark-blue">
          Examination (F2F clinics)
        </h2>
        <div className="space-y-3">
          <Row label="Palpable abdominal mass">
            <YesNoToggle value={value.palpableAbdoMass} onChange={(v) => set('palpableAbdoMass', v)} />
          </Row>
          <Row label="Palpable rectal mass on PR">
            <YesNoToggle value={value.palpableRectalMass} onChange={(v) => set('palpableRectalMass', v)} />
          </Row>
          {value.palpableRectalMass === 'yes' && (
            <Row label="Mass low and tender">
              <YesNoToggle
                value={value.rectalMassLowAndTender}
                onChange={(v) => set('rectalMassLowAndTender', v)}
              />
            </Row>
          )}
          <div>
            <label className="label" htmlFor="examFindings">
              Examination findings (free text)
            </label>
            <textarea
              id="examFindings"
              rows={2}
              className="input"
              value={value.examinationFindings}
              onChange={(e) => set('examinationFindings', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* History & risk factors */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-nhs-dark-blue">
          History & risk factors
        </h2>
        <div className="space-y-3">
          <Row label="Family history of CRC or IBD">
            <YesNoToggle value={value.fhxCrcOrIbd} onChange={(v) => set('fhxCrcOrIbd', v)} />
          </Row>
          <Row label="Previous colorectal cancer">
            <YesNoToggle value={value.previousCRC} onChange={(v) => set('previousCRC', v)} />
          </Row>
          <Row label="Known IBD">
            <YesNoToggle value={value.ibd} onChange={(v) => set('ibd', v)} />
          </Row>
          <Row label="Colonoscopy in last 2 years">
            <YesNoToggle
              value={value.priorColonoscopyWithin2y}
              onChange={(v) => set('priorColonoscopyWithin2y', v)}
            />
          </Row>
          {value.priorColonoscopyWithin2y === 'yes' && (
            <div>
              <label className="label" htmlFor="priorCol">Prior colonoscopy findings</label>
              <textarea
                id="priorCol"
                rows={2}
                className="input"
                value={value.priorColonoscopyFindings}
                onChange={(e) => set('priorColonoscopyFindings', e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="label" htmlFor="recentInv">Other recent investigations</label>
            <textarea
              id="recentInv"
              rows={2}
              className="input"
              value={value.recentInvestigations}
              onChange={(e) => set('recentInvestigations', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="pmh">PMH</label>
              <textarea id="pmh" rows={2} className="input" value={value.pmh} onChange={(e) => set('pmh', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="sh">Surgical history</label>
              <textarea id="sh" rows={2} className="input" value={value.surgicalHistory} onChange={(e) => set('surgicalHistory', e.target.value)} />
            </div>
          </div>
        </div>
      </section>

      {/* Meds */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-nhs-dark-blue">Medications & allergies</h2>
        <div className="space-y-3">
          <Row label="Anticoagulant">
            <YesNoToggle value={value.onAnticoag} onChange={(v) => set('onAnticoag', v)} />
            {value.onAnticoag === 'yes' && (
              <input
                aria-label="Anticoagulant details"
                placeholder="e.g. apixaban 5mg BD"
                className="input ml-2 max-w-xs"
                value={value.anticoagDetails}
                onChange={(e) => set('anticoagDetails', e.target.value)}
              />
            )}
          </Row>
          <Row label="Antiplatelet">
            <YesNoToggle value={value.onAntiplatelet} onChange={(v) => set('onAntiplatelet', v)} />
            {value.onAntiplatelet === 'yes' && (
              <input
                aria-label="Antiplatelet details"
                placeholder="e.g. clopidogrel 75mg OD"
                className="input ml-2 max-w-xs"
                value={value.antiplateletDetails}
                onChange={(e) => set('antiplateletDetails', e.target.value)}
              />
            )}
          </Row>
          <div>
            <label className="label" htmlFor="dh">Other drug history</label>
            <textarea id="dh" rows={2} className="input" value={value.drugHistory} onChange={(e) => set('drugHistory', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="al">Allergies</label>
            <input id="al" className="input" value={value.allergies} onChange={(e) => set('allergies', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Social / female-specific */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-nhs-dark-blue">Social & other</h2>
        <div className="space-y-3">
          <Row label="Smoker">
            <YesNoToggle value={value.smoker} onChange={(v) => set('smoker', v)} />
          </Row>
          <Row label="Alcohol">
            <YesNoToggle value={value.alcohol} onChange={(v) => set('alcohol', v)} />
          </Row>
          {isFemale && childbearingAge && (
            <>
              <div>
                <label className="label" htmlFor="lmp">LMP</label>
                <input id="lmp" className="input max-w-xs" value={value.lmp} onChange={(e) => set('lmp', e.target.value)} />
              </div>
              <Row label="Pregnant">
                <YesNoToggle
                  value={value.pregnant ?? 'unknown'}
                  onChange={(v) => set('pregnant', v)}
                  includeUnknown
                />
              </Row>
            </>
          )}
        </div>
      </section>

      {/* Procedure fitness */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-nhs-dark-blue">Procedure fitness</h2>
        <div className="space-y-3">
          <Row label="Independent in ADLs">
            <YesNoToggle value={value.independentADLs} onChange={(v) => set('independentADLs', v)} />
          </Row>
          <Row label="Uses mobility aids">
            <YesNoToggle value={value.mobilityAids} onChange={(v) => set('mobilityAids', v)} />
            {value.mobilityAids === 'yes' && (
              <input
                aria-label="Mobility aids details"
                placeholder="e.g. zimmer frame, wheelchair"
                className="input ml-2 max-w-xs"
                value={value.mobilityAidsDetails}
                onChange={(e) => set('mobilityAidsDetails', e.target.value)}
              />
            )}
          </Row>
          <Row label="Overnight escort available">
            <YesNoToggle value={value.overnightEscort} onChange={(v) => set('overnightEscort', v)} />
          </Row>
          <Row label="Fit for bowel prep">
            <YesNoToggle value={value.fitForBowelPrep} onChange={(v) => set('fitForBowelPrep', v)} />
          </Row>
          <Row label="Fit for sedation">
            <YesNoToggle value={value.fitForSedation} onChange={(v) => set('fitForSedation', v)} />
          </Row>
        </div>
      </section>

      {/* Consent */}
      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-nhs-dark-blue">Consent & info</h2>
        <div className="space-y-3">
          <Row label="Investigations explained">
            <YesNoToggle value={value.investigationsExplained} onChange={(v) => set('investigationsExplained', v)} />
          </Row>
          <Row label="Patient information leaflet given">
            <YesNoToggle value={value.infoGiven} onChange={(v) => set('infoGiven', v)} />
          </Row>
        </div>
      </section>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 py-2 last:border-0">
      <span className="text-sm font-medium text-nhs-dark-grey">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

function NumberField({
  id,
  label,
  v,
  onChange,
  inline = false,
  step,
}: {
  id: string
  label: string
  v: number | null
  onChange: (n: number | null) => void
  inline?: boolean
  step?: string
}) {
  return (
    <div className={inline ? 'inline-flex items-center gap-2' : ''}>
      <label htmlFor={id} className={inline ? 'text-xs text-nhs-mid-grey' : 'label'}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        step={step ?? '1'}
        className={`input ${inline ? 'w-24' : ''}`}
        value={v ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </div>
  )
}
