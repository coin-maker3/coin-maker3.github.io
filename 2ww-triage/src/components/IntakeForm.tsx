/**
 * IntakeForm — laid out top-to-bottom to mirror the GEH 2WW colorectal
 * clinic letter / proforma. Section headings and question wording are kept
 * verbatim where possible so an FY1 doing the audit can read the letter
 * line by line and fill the form line by line, no hunting.
 *
 * Letter field order (anchor):
 *   1. Reason for referral (header + clinic/encounter type + additional info)
 *   2. FIT, age/gender, WHO, date of bloods, Hb/Ferritin/MCV/GFR
 *   3. Past medical, surgical, drug history + allergies
 *   4. Symptoms (CIBH, PR bleed, mucus, tenesmus, weight loss, abdo pain)
 *   5. Family history & previous abdominal problems/operations
 *   6. Recent investigations
 *   7. Social (smoking, alcohol)
 *   8. Female-specific (LMP, pregnancy)
 *   9. Procedure fitness (ADLs, mobility, escort) + clinical fit-for-prep/sedation
 *   10. Examination findings (incl DRE for F2F) + palpable-mass flags for the engine
 *   11. Consent & information given
 *
 * Algorithm-required flags that the letter does not surface as discrete
 * fields (palpable abdo/rectal mass yes/no, fit for bowel prep, fit for
 * sedation, lacks capacity) are kept in the audit form because the engine
 * uses them — they are labelled "(read from examination findings)" or
 * "(clinical judgement)" so the FY1 knows where to derive the answer.
 */
import { AlertTriangle } from 'lucide-react'
import {
  CLINIC_TYPE,
  PR_BLEED,
  REFERRAL_REASONS,
  REFERRAL_REASON_LABELS,
  SEX,
  ageToBand,
  type Intake,
} from '../schema/intake'
import { YesNoToggle } from './YesNo'
import { PID_LABELS, scanForPid } from '../lib/pid-scan'

function PidWarning({ text }: { text: string }) {
  const hits = scanForPid(text)
  if (hits.length === 0) return null
  return (
    <div
      className="mt-1 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div>
        <strong>Possible patient identifier:</strong>{' '}
        {hits.map((h, i) => (
          <span key={i}>
            {i > 0 && '; '}
            {PID_LABELS[h.pattern]} ("{h.match}")
          </span>
        ))}
        . Please remove — the audit must not contain PID.
      </div>
    </div>
  )
}

interface Props {
  value: Intake
  onChange: (next: Intake) => void
}

type K = keyof Intake

export function IntakeForm({ value, onChange }: Props) {
  const set = <Key extends K>(k: Key, v: Intake[Key]) =>
    onChange({ ...value, [k]: v })

  // Age is the source of truth; the algorithm reads `ageBand` so we
  // derive it whenever age changes. Future: when EPR integration lands,
  // patient details will set age directly and the band updates automatically.
  const setAge = (newAge: number | null) => {
    if (newAge === null) {
      onChange({ ...value, age: null })
    } else {
      onChange({ ...value, age: newAge, ageBand: ageToBand(newAge) })
    }
  }

  const toggleReason = (reason: (typeof REFERRAL_REASONS)[number]) => {
    const current = value.referralReasons
    const next = current.includes(reason)
      ? current.filter((r) => r !== reason)
      : [...current, reason]
    onChange({ ...value, referralReasons: next })
  }

  const isFemale = value.sex === 'F'
  const childbearingAge =
    value.age != null ? value.age < 50 : ['<40', '40-49'].includes(value.ageBand)

  return (
    <div className="space-y-6">
      {/* 1. Reason for referral (letter header) */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">
          Reason for referral
        </h2>
        <p className="mb-4 text-xs text-nhs-mid-grey">
          Top of letter: "This patient has been referred as a 2-week-wait for
          suspected colorectal cancer…"
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="clinicType">Clinic type / encounter</label>
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
        </div>
        <fieldset className="mt-4">
          <legend className="label">Reason for referral (tick all that apply)</legend>
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
          <label className="label" htmlFor="referralNotes">Additional information</label>
          <textarea
            id="referralNotes"
            rows={3}
            className="input"
            placeholder="Anonymised — no name / DOB / NHS number."
            value={value.referralNotes}
            onChange={(e) => set('referralNotes', e.target.value)}
          />
          <PidWarning text={value.referralNotes} />
        </div>
      </section>

      {/* 2. FIT + demographics + bloods (letter table rows 1-5) */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">
          Patient details &amp; most recent blood tests
        </h2>
        <p className="mb-4 text-xs text-nhs-mid-grey">
          Letter rows: FIT · Age / Gender · WHO · Hb / Ferritin / MCV / GFR (within last 3 months per Trust IDA criteria).
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <NumberField id="fit" label="FIT (µg Hb / g)" v={value.fit} onChange={(n) => set('fit', n)} step="0.1" />
          <div>
            <label className="label" htmlFor="age">Age (years)</label>
            <input
              id="age"
              type="number"
              min={0}
              max={120}
              className="input"
              placeholder="e.g. 67"
              value={value.age ?? ''}
              onChange={(e) =>
                setAge(e.target.value === '' ? null : Number(e.target.value))
              }
            />
            <div className="mt-1 text-[11px] text-nhs-mid-grey">
              Algorithm band: <span className="font-mono">{value.ageBand}</span>
              {value.age != null && ' (derived)'}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="sex">Gender</label>
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
            <label className="label" htmlFor="who">WHO score (0–4)</label>
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
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <NumberField id="hb" label="Hb (g/L)" v={value.hb} onChange={(n) => set('hb', n)} />
          <NumberField id="ferritin" label="Ferritin (µg/L)" v={value.ferritin} onChange={(n) => set('ferritin', n)} />
          <NumberField id="mcv" label="MCV (fL)" v={value.mcv} onChange={(n) => set('mcv', n)} />
          <NumberField id="gfr" label="GFR (ml/min)" v={value.gfr} onChange={(n) => set('gfr', n)} />
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

      {/* 3. Past medical, surgical and drug history + allergies (letter rows 7-11) */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">
          Past medical, surgical and drug history
        </h2>
        <p className="mb-4 text-xs text-nhs-mid-grey">
          Letter: "Do you have any relevant past medical, surgical or drug history?"
        </p>
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="pmh">Past medical or surgical history</label>
            <textarea id="pmh" rows={2} className="input" value={value.pmh} onChange={(e) => set('pmh', e.target.value)} />
            <PidWarning text={value.pmh} />
          </div>
          <div>
            <label className="label" htmlFor="sh">Previous operations</label>
            <textarea id="sh" rows={2} className="input" value={value.surgicalHistory} onChange={(e) => set('surgicalHistory', e.target.value)} />
            <PidWarning text={value.surgicalHistory} />
          </div>
          <Row label="Anticoagulants">
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
          <Row label="Antiplatelets">
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

      {/* 4. Symptoms (letter rows 13-24) */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">Symptoms</h2>
        <p className="mb-4 text-xs text-nhs-mid-grey">
          Letter order: bowel habit · rectal bleeding · mucus PR · tenesmus · weight loss · abdominal pain.
        </p>
        <div className="space-y-3">
          <Row label="Have you had any change in bowel habit?">
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

          <Row label="Have you had any rectal bleeding?">
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

          <Row label="Have you experienced any mucus per rectum?">
            <YesNoToggle value={value.mucusPR} onChange={(v) => set('mucusPR', v)} />
          </Row>

          <Row label="Has there been any tenesmus or incomplete evacuation?">
            <YesNoToggle value={value.tenesmus} onChange={(v) => set('tenesmus', v)} />
          </Row>

          <Row label="Have you experienced any weight loss?">
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

          <Row label="Have you experienced any abdominal pain?">
            <YesNoToggle value={value.abdominalPain} onChange={(v) => set('abdominalPain', v)} />
          </Row>
        </div>
      </section>

      {/* 5. Family history & previous abdominal/colorectal disease (letter rows 26-29) */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">
          Family history &amp; previous abdominal disease
        </h2>
        <p className="mb-4 text-xs text-nhs-mid-grey">
          Letter: bowel cancer or IBD in family · previous abdominal problems or operations.
        </p>
        <div className="space-y-3">
          <Row label="Family history of bowel cancer or IBD?">
            <YesNoToggle value={value.fhxCrcOrIbd} onChange={(v) => set('fhxCrcOrIbd', v)} />
          </Row>
          <Row label="Previous colorectal cancer?">
            <YesNoToggle value={value.previousCRC} onChange={(v) => set('previousCRC', v)} />
          </Row>
          <Row label="Known inflammatory bowel disease?">
            <YesNoToggle value={value.ibd} onChange={(v) => set('ibd', v)} />
          </Row>
          <Row label="Colonoscopy in last 2 years?">
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
        </div>
      </section>

      {/* 6. Recent investigations (letter rows 31-32) */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">Recent investigations</h2>
        <p className="mb-4 text-xs text-nhs-mid-grey">
          Letter: "Have you had any recent investigations?"
        </p>
        <textarea
          id="recentInv"
          rows={2}
          className="input"
          placeholder="e.g. CT abdomen 2 months ago, USS abdomen, OGD"
          value={value.recentInvestigations}
          onChange={(e) => set('recentInvestigations', e.target.value)}
        />
      </section>

      {/* 7. Social (letter rows 34-35) */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">Social</h2>
        <div className="space-y-3">
          <Row label="Do you smoke?">
            <YesNoToggle value={value.smoker} onChange={(v) => set('smoker', v)} />
          </Row>
          <Row label="Do you consume any alcohol?">
            <YesNoToggle value={value.alcohol} onChange={(v) => set('alcohol', v)} />
          </Row>
        </div>
      </section>

      {/* 8. Female-specific (letter rows 37-38, conditional) */}
      {isFemale && childbearingAge && (
        <section className="card">
          <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">
            Female-specific
          </h2>
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="lmp">What date was your last period?</label>
              <input id="lmp" className="input max-w-xs" value={value.lmp} onChange={(e) => set('lmp', e.target.value)} />
            </div>
            <Row label="Are you pregnant?">
              <YesNoToggle
                value={value.pregnant ?? 'unknown'}
                onChange={(v) => set('pregnant', v)}
                includeUnknown
              />
            </Row>
          </div>
        </section>
      )}

      {/* 9. Procedure fitness (letter rows 40-44) */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">Procedure fitness</h2>
        <p className="mb-4 text-xs text-nhs-mid-grey">
          Letter: ADLs · mobility aids · overnight accompaniment. Fit-for-prep and fit-for-sedation are clinical judgement (not in letter).
        </p>
        <div className="space-y-3">
          <Row label="Are you independent in your activities of daily living?">
            <YesNoToggle value={value.independentADLs} onChange={(v) => set('independentADLs', v)} />
          </Row>
          <Row label="Do you use any mobility aids?">
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
          <Row label="Can someone stay overnight and accompany you home after the procedure?">
            <YesNoToggle value={value.overnightEscort} onChange={(v) => set('overnightEscort', v)} />
          </Row>
          <Row label="Fit for bowel prep (clinical judgement)">
            <YesNoToggle value={value.fitForBowelPrep} onChange={(v) => set('fitForBowelPrep', v)} />
          </Row>
          <Row label="Fit for sedation (clinical judgement)">
            <YesNoToggle value={value.fitForSedation} onChange={(v) => set('fitForSedation', v)} />
          </Row>
          <Row label="Patient lacks capacity / unable to comply with tel clinic">
            <YesNoToggle value={value.lacksCapacity} onChange={(v) => set('lacksCapacity', v)} />
          </Row>
        </div>
      </section>

      {/* 10. Examination findings (letter rows 46-47) */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">
          Examination findings
        </h2>
        <p className="mb-4 text-xs text-nhs-mid-grey">
          Letter: "What are the examination findings (including digital rectal
          examination findings for face to face clinics)?"
        </p>
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="examFindings">
              Examination findings (free text)
            </label>
            <textarea
              id="examFindings"
              rows={3}
              className="input"
              value={value.examinationFindings}
              onChange={(e) => set('examinationFindings', e.target.value)}
            />
            <PidWarning text={value.examinationFindings} />
          </div>
          <p className="text-xs text-nhs-mid-grey">
            Read from the free text above and tick yes/no below — the algorithm uses these flags:
          </p>
          <Row label="Palpable abdominal mass?">
            <YesNoToggle value={value.palpableAbdoMass} onChange={(v) => set('palpableAbdoMass', v)} />
          </Row>
          <Row label="Palpable rectal mass on PR?">
            <YesNoToggle value={value.palpableRectalMass} onChange={(v) => set('palpableRectalMass', v)} />
          </Row>
          {value.palpableRectalMass === 'yes' && (
            <Row label="Mass low and tender?">
              <YesNoToggle
                value={value.rectalMassLowAndTender}
                onChange={(v) => set('rectalMassLowAndTender', v)}
              />
            </Row>
          )}
        </div>
      </section>

      {/* 11. Consent & information (letter rows 49-50) */}
      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-nhs-dark-blue">
          Consent &amp; information
        </h2>
        <div className="space-y-3">
          <Row label="Have the investigations required been explained to the patient?">
            <YesNoToggle value={value.investigationsExplained} onChange={(v) => set('investigationsExplained', v)} />
          </Row>
          <Row label="Has the patient received all the necessary information?">
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
