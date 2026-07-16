import { useMemo, useState } from 'react'
import { ClipboardCopy, Check } from 'lucide-react'
import { IntakeForm } from '../components/IntakeForm'
import { DecisionCard } from '../components/DecisionCard'
import { PathViewer } from '../components/PathViewer'
import { ActualOutcomePanel } from '../components/ActualOutcomePanel'
import { decide } from '../algorithm/engine'
import { ALGORITHM_VERSION } from '../algorithm/version'
import { DEFAULT_INTAKE, type Intake } from '../schema/intake'
import { INVESTIGATION_LABELS, type Investigation } from '../algorithm/types'
import {
  EXCLUSION_REASONS,
  EXCLUSION_REASON_LABELS,
  DISCORDANCE_REASON_LABELS,
  DISCORDANCE_DIRECTION_LABELS,
  FINAL_DIAGNOSES,
  FINAL_DIAGNOSIS_LABELS,
  type ExclusionReason,
  type DiscordanceReason,
  type DiscordanceDirection,
  type FinalDiagnosis,
} from '../audit/types'
import { linkTo } from '../lib/router'
import { dedupeHits, scanClinicalText } from '../algorithm/text-scan'

// Column order — MUST stay in lock-step with the Teams audit-sheet template
// (2WW-Colorectal-Audit.xlsx). "Copy row" emits these, tab-separated.
export const AUDIT_COLUMNS = [
  'Case ID (MRN)', 'Reviewer', 'Clinic month', 'Excluded', 'Exclusion reason',
  'Age', 'Sex', 'WHO', 'Referral reasons', 'Hb', 'MCV', 'Ferritin', 'FIT', 'GFR',
  'CIBH', 'CIBH weeks', 'PR bleed', 'Tenesmus', 'Mucus PR', 'Abdominal pain',
  'Weight loss', 'Weight loss (kg)', 'Palpable abdo mass', 'Palpable rectal mass',
  'FHx CRC/IBD', 'Previous CRC', 'IBD', 'Prior colonoscopy <2y', 'Fit for bowel prep',
  'Tool recommendation', 'Algorithm version', 'Actual decision', 'Concordant',
  'Discordance reason', 'Discordance direction', 'Final diagnosis', 'Notes', 'Date entered',
  // ---- form 3 (full capture, Jul 2026) — appended AFTER the original 38 so every
  // ---- old row stays column-aligned. Structured fields only; free text is
  // ---- deliberately excluded (PID surface; it never changes the recommendation).
  'Form version', 'Clinic type', 'CFS', 'Hb prior', 'Ferritin prior', 'Bloods <3 months',
  'FIT done', 'Bleeding source visible', 'Rectal mass low+tender', 'DRE documented in referral',
  'Abnormal CT', 'Prior CTVC <2y', 'Prior bowel surgery', 'Lacks capacity',
  'Anticoagulant', 'Antiplatelet', 'Smoker', 'Alcohol',
  'Independent ADLs', 'Mobility aids', 'Overnight escort', 'Fit for sedation',
  'Investigations explained', 'Info given', 'Decision-maker grade', 'Time taken (min)',
  'Free-text scan hits', 'Row end (check)',
]

// "Not documented" (Mr Wanigasooriya, Jul 2026): the yes/no questions carry a third
// honest state for letters that don't mention the item. Declared convention: ND
// computes as 'no' for the recommendation (the Trust algorithm has no unknown
// branches); the audit row records "ND" so the data distinguishes a true documented
// negative from silence. Fields default to ND — that is the truthful state before
// the reviewer has read the letter, and it makes "No" mean something.
const ND_FIELDS: [string, string][] = [
  ['cibh', 'CIBH'], ['tenesmus', 'Tenesmus'], ['mucusPR', 'Mucus PR'],
  ['weightLoss', 'Weight loss'], ['abdominalPain', 'Abdominal pain'],
  ['palpableAbdoMass', 'Palpable abdo mass'], ['palpableRectalMass', 'Palpable rectal mass'],
  ['fhxCrcOrIbd', 'FHx CRC/IBD'], ['previousCRC', 'Previous CRC'], ['ibd', 'IBD'],
  ['priorColonoscopyWithin2y', 'Prior colonoscopy <2y'], ['fitForBowelPrep', 'Fit for bowel prep'],
]

// small tri-state toggle for the referral-record metadata (not engine inputs)
function TriToggle({ value, onChange, labels = ['Yes', 'No', 'Not documented'] }: {
  value: string; onChange: (v: string) => void; labels?: [string, string, string] | string[]
}) {
  const vals = ['yes', 'no', 'nd']
  return (
    <div className="toggle-yn" role="group">
      {vals.map((v, i) => (
        <button key={v} type="button" className={v === 'nd' ? 'nd' : ''}
          aria-pressed={value === v} onClick={() => onChange(v)}>
          {labels[i]}
        </button>
      ))}
    </div>
  )
}

const yyyyMm = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const clean = (v: unknown) => String(v ?? '').replace(/[\t\n\r]+/g, ' ').trim()

export function AuditNewPage() {
  const [intake, setIntake] = useState<Intake>(DEFAULT_INTAKE)
  const decision = useMemo(() => decide(intake), [intake])

  const [caseId, setCaseId] = useState('')
  const [enteredBy, setEnteredBy] = useState('')
  const [clinicMonth, setClinicMonth] = useState(yyyyMm())
  const [actualDecision, setActualDecision] = useState<Investigation | ''>('')
  const [actualNotes, setActualNotes] = useState('')
  const [reviewerNotes, setReviewerNotes] = useState('')
  const [discordanceReason, setDiscordanceReason] = useState<DiscordanceReason | ''>('')
  const [discordanceDirection, setDiscordanceDirection] = useState<DiscordanceDirection | ''>('')
  const [finalDiagnosis, setFinalDiagnosis] = useState<FinalDiagnosis | ''>('')
  const [excluded, setExcluded] = useState(false)
  const [exclusionReason, setExclusionReason] = useState<ExclusionReason | ''>('')
  const [exclusionNotes, setExclusionNotes] = useState('')
  const [ndSet, setNdSet] = useState<Set<string>>(new Set(ND_FIELDS.map(([k]) => k)))
  const setNd = (f: string, v: boolean) =>
    setNdSet((p) => { const n = new Set(p); if (v) n.add(f); else n.delete(f); return n })
  const ndLabels = ND_FIELDS.filter(([k]) => ndSet.has(k)).map(([, l]) => l)
  // form-3 audit metadata (not engine inputs) — referral-record tri-states default to
  // "not documented", the truthful zero-knowledge state; FIT auto-resolves to Done
  // the moment a FIT value is typed.
  type Tri = 'yes' | 'no' | 'nd'
  const [dreDocumented, setDreDocumented] = useState<Tri>('nd')
  const [bloodsWithin3mo, setBloodsWithin3mo] = useState<Tri>('nd')
  const [fitDone, setFitDone] = useState<'done' | 'not_done' | 'nd'>('nd')
  const [decisionGrade, setDecisionGrade] = useState('')
  const [timeTakenMin, setTimeTakenMin] = useState('')
  const fitDoneEff = intake.fit != null ? 'done' : fitDone
  const triTxt = (t: Tri) => (t === 'nd' ? 'ND' : t)
  const [copiedRow, setCopiedRow] = useState<string | null>(null)

  const isConcordant = actualDecision !== '' && actualDecision === decision.investigation
  const discordanceComplete = discordanceReason !== '' && discordanceDirection !== ''
  const coreOk =
    caseId.trim().length >= 1 &&
    enteredBy.length >= 2 &&
    /^\d{4}-\d{2}$/.test(clinicMonth)
  const canCopy = excluded
    ? coreOk && exclusionReason !== ''
    : coreOk &&
      actualDecision !== '' &&
      intake.age != null && intake.age >= 0 && intake.age <= 120 &&
      finalDiagnosis !== '' &&
      (isConcordant || discordanceComplete)

  const buildRow = (): string => {
    const inv = (i: Investigation | '') => (i ? INVESTIGATION_LABELS[i as Investigation] : '')
    const v = (x: unknown) => (x == null ? '' : String(x))
    const notes = [reviewerNotes, actualNotes, excluded ? exclusionNotes : ''].filter(Boolean).join(' | ')
    // ND = "not documented in the letter" — recorded faithfully; computed as 'no'
    const tri = (k: string, val: unknown) => (ndSet.has(k) ? 'ND' : val == null ? '' : String(val))
    const cells = [
      caseId, enteredBy.toUpperCase().slice(0, 4), clinicMonth,
      excluded ? 'Yes' : 'No',
      excluded ? EXCLUSION_REASON_LABELS[exclusionReason as ExclusionReason] || '' : '',
      excluded ? '' : v(intake.age),
      excluded ? '' : intake.sex,
      excluded ? '' : v(intake.whoScore),
      excluded ? '' : (intake.referralReasons || []).join('; '),
      excluded ? '' : v(intake.hb),
      excluded ? '' : v(intake.mcv),
      excluded ? '' : v(intake.ferritin),
      excluded ? '' : v(intake.fit),
      excluded ? '' : v(intake.gfr),
      excluded ? '' : tri('cibh', intake.cibh),
      excluded ? '' : v(intake.cibhDurationWeeks),
      excluded ? '' : intake.prBleed,
      excluded ? '' : tri('tenesmus', intake.tenesmus),
      excluded ? '' : tri('mucusPR', intake.mucusPR),
      excluded ? '' : tri('abdominalPain', intake.abdominalPain),
      excluded ? '' : tri('weightLoss', intake.weightLoss),
      excluded ? '' : v(intake.weightLossKg),
      excluded ? '' : tri('palpableAbdoMass', intake.palpableAbdoMass),
      excluded ? '' : tri('palpableRectalMass', intake.palpableRectalMass),
      excluded ? '' : tri('fhxCrcOrIbd', intake.fhxCrcOrIbd),
      excluded ? '' : tri('previousCRC', intake.previousCRC),
      excluded ? '' : tri('ibd', intake.ibd),
      excluded ? '' : tri('priorColonoscopyWithin2y', intake.priorColonoscopyWithin2y),
      excluded ? '' : tri('fitForBowelPrep', intake.fitForBowelPrep),
      excluded ? '' : inv(decision.investigation),
      ALGORITHM_VERSION.version,   // form version has its own column now (col 39)
      excluded ? '' : inv(actualDecision),
      excluded ? '' : (isConcordant ? 'Yes' : 'No'),
      !excluded && !isConcordant && discordanceReason ? DISCORDANCE_REASON_LABELS[discordanceReason] : '',
      !excluded && !isConcordant && discordanceDirection ? DISCORDANCE_DIRECTION_LABELS[discordanceDirection] : '',
      finalDiagnosis ? FINAL_DIAGNOSIS_LABELS[finalDiagnosis] : '',
      notes,
      new Date().toISOString().slice(0, 10),
      // ---- form 3: full structured capture (appended after the original 38) ----
      '3',
      excluded ? '' : (intake.clinicType === 'telephone' ? 'Telephone' : 'Face to face'),
      excluded ? '' : v(intake.cfs),
      excluded ? '' : v(intake.hbPrior),
      excluded ? '' : v(intake.ferritinPrior),
      excluded ? '' : triTxt(bloodsWithin3mo),
      excluded ? '' : (fitDoneEff === 'nd' ? 'ND' : fitDoneEff === 'done' ? 'Done' : 'Not done'),
      excluded ? '' : intake.bleedingSourceVisible,
      excluded ? '' : intake.rectalMassLowAndTender,
      excluded ? '' : triTxt(dreDocumented),
      excluded ? '' : intake.abnormalCt,
      excluded ? '' : intake.priorCtvcWithin2y,
      excluded ? '' : intake.priorBowelSurgery,
      excluded ? '' : intake.lacksCapacity,
      excluded ? '' : intake.onAnticoag,
      excluded ? '' : intake.onAntiplatelet,
      excluded ? '' : intake.smoker,
      excluded ? '' : intake.alcohol,
      excluded ? '' : intake.independentADLs,
      excluded ? '' : intake.mobilityAids,
      excluded ? '' : intake.overnightEscort,
      excluded ? '' : intake.fitForSedation,
      excluded ? '' : intake.investigationsExplained,
      excluded ? '' : intake.infoGiven,
      excluded ? '' : decisionGrade,
      excluded ? '' : timeTakenMin,
      // scan-hit CATEGORIES only — the structured signal from free text, never the
      // verbatim text itself (PID surface stays zero)
      excluded ? '' : dedupeHits([
        ...scanClinicalText(intake.examinationFindings ?? '', 'examination findings'),
        ...scanClinicalText(intake.pmh ?? '', 'PMH'),
        ...scanClinicalText(intake.surgicalHistory ?? '', 'previous operations'),
        ...scanClinicalText(intake.drugHistory ?? '', 'drug history'),
        ...scanClinicalText(intake.referralNotes ?? '', 'referral notes'),
        ...scanClinicalText(intake.recentInvestigations ?? '', 'recent investigations'),
        ...scanClinicalText(intake.priorColonoscopyFindings ?? '', 'prior colonoscopy findings'),
      ]).map((h) => h.category).join('; '),
      'END ' + new Date().toISOString().slice(0, 10),   // paste-integrity check cell
    ]
    return cells.map(clean).join('\t')
  }

  const copyRow = async () => {
    if (!canCopy) return
    const row = buildRow()
    try { await navigator.clipboard.writeText(row) } catch { /* fall back to the textarea below */ }
    setCopiedRow(row)
  }

  if (copiedRow) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <div className="card border-l-4 border-l-nhs-green">
          <h2 className="text-2xl font-semibold text-nhs-green"><Check className="mr-1 inline h-6 w-6" /> Copied</h2>
          <div className="mx-auto mt-3 max-w-md rounded-md bg-blue-50 p-3 text-left text-xs text-nhs-dark-blue">
            <b>Pasting so it lands correctly (30 seconds):</b>
            <ol className="ml-4 mt-1 list-decimal space-y-1">
              <li>Open the workbook in <b>desktop Excel</b> ("Open in app" from Teams), not the browser.</li>
              <li><b>Single-click</b> the first empty <b>Case ID</b> cell — don't double-click into it.</li>
              <li>Ctrl&nbsp;+&nbsp;V — the row spreads across all columns by itself.</li>
              <li>Check the <b>last cell</b> of the row reads <b>"END {new Date().toISOString().slice(0, 10)}"</b>. If it doesn't, Ctrl&nbsp;+&nbsp;Z and try again in desktop Excel.</li>
            </ol>
          </div>
          <p className="mt-2 text-xs text-nhs-mid-grey">
            The tool stored nothing — all data lives only in your Trust Teams sheet.
          </p>
          <textarea
            readOnly
            className="input mt-3 h-20 w-full font-mono text-[11px]"
            value={copiedRow}
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className="mt-1 text-[11px] text-nhs-mid-grey">If the auto-copy didn't work, tap the box above and copy manually.</p>
          <div className="mt-4 flex justify-center gap-3">
            <button className="btn-primary" onClick={() => window.location.reload()}>Enter next case</button>
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
            <h1 className="text-xl font-bold text-nhs-dark-blue">2WW Audit — enter case</h1>
            <p className="text-xs text-nhs-mid-grey">George Eliot Hospital · concordance audit</p>
          </div>
          <a className="btn-secondary" href={linkTo.audit()}>Cancel</a>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_460px]">
          <div className="space-y-6">
            <section className="card">
              <h2 className="text-lg font-semibold text-nhs-dark-blue">Case</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="caseId">Case ID / MRN</label>
                  <input id="caseId" className="input" placeholder="e.g. MRN" value={caseId}
                    onChange={(e) => setCaseId(e.target.value)} autoComplete="off" />
                </div>
                <div>
                  <label className="label" htmlFor="enteredBy">Reviewer initials</label>
                  <input id="enteredBy" className="input" placeholder="e.g. AB" value={enteredBy}
                    onChange={(e) => setEnteredBy(e.target.value)} maxLength={4} />
                </div>
                <div>
                  <label className="label" htmlFor="clinicMonth">Clinic month</label>
                  <input id="clinicMonth" type="month" className="input" value={clinicMonth}
                    onChange={(e) => setClinicMonth(e.target.value)} />
                </div>
              </div>
              <p className="mt-2 text-xs text-nhs-mid-grey">
                This tool <b>stores nothing</b> — it only works out the recommended investigation. You copy each
                completed case into the Trust Teams audit sheet, which is the only place data is kept.
              </p>
            </section>

            {/* Exclusion gate */}
            <section className="card border-l-4 border-l-nhs-mid-grey">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={excluded} onChange={(e) => setExcluded(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-nhs-blue focus:ring-nhs-bright-blue" />
                Exclude this case from the concordance analysis
              </label>
              <p className="mt-1 text-xs text-nhs-mid-grey">
                Per AUDIT-PROTOCOL §6. Excluded cases are still recorded (denominator transparency) but don't
                contribute to the primary concordance outcome.
              </p>
              {excluded && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="label" htmlFor="exclusionReason">Exclusion reason</label>
                    <select id="exclusionReason" className="select" value={exclusionReason}
                      onChange={(e) => setExclusionReason(e.target.value as ExclusionReason)}>
                      <option value="">— select —</option>
                      {EXCLUSION_REASONS.map((r) => (<option key={r} value={r}>{EXCLUSION_REASON_LABELS[r]}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="exclusionNotes">Exclusion notes (optional)</label>
                    <textarea id="exclusionNotes" rows={2} className="input" placeholder="e.g. duplicate of MRN…"
                      value={exclusionNotes} onChange={(e) => setExclusionNotes(e.target.value)} maxLength={500} />
                  </div>
                </div>
              )}
            </section>

            {!excluded && (
              <>
                <IntakeForm value={intake} onChange={setIntake} nd={ndSet} onNd={setNd} />

                <section className="card border-l-4 border-l-nhs-mid-grey">
                  <h2 className="text-lg font-semibold text-nhs-dark-blue">Referral record</h2>
                  <p className="mb-3 mt-1 text-xs text-nhs-mid-grey">
                    About the referral/letter itself — goes into the audit row for the
                    documentation-quality analysis. Never changes the recommendation.
                  </p>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">DRE documented in the referral?</span>
                      <TriToggle value={dreDocumented} onChange={(v) => setDreDocumented(v as Tri)} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">Bloods within the last 3 months?</span>
                      <TriToggle value={bloodsWithin3mo} onChange={(v) => setBloodsWithin3mo(v as Tri)} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">FIT test</span>
                      {intake.fit != null ? (
                        <span className="text-sm text-nhs-green font-semibold">Done — value entered above</span>
                      ) : (
                        <TriToggle
                          value={fitDone === 'done' ? 'yes' : fitDone === 'not_done' ? 'no' : 'nd'}
                          onChange={(v) => setFitDone(v === 'yes' ? 'done' : v === 'no' ? 'not_done' : 'nd')}
                          labels={['Done (no value)', 'Not done', 'Not documented']} />
                      )}
                    </div>
                  </div>
                </section>

                <ActualOutcomePanel
                  toolDecision={decision.investigation}
                  actualDecision={actualDecision}
                  onActualChange={setActualDecision}
                  notes={actualNotes}
                  onNotesChange={setActualNotes}
                  reviewerNotes={reviewerNotes}
                  onReviewerNotesChange={setReviewerNotes}
                  discordanceReason={discordanceReason}
                  onDiscordanceReasonChange={setDiscordanceReason}
                  discordanceDirection={discordanceDirection}
                  onDiscordanceDirectionChange={setDiscordanceDirection}
                />

                <section className="card">
                  <h2 className="text-sm font-semibold text-nhs-dark-blue">Decision & entry details</h2>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="decisionGrade">Actual decision made by (grade only)</label>
                      <select id="decisionGrade" className="select" value={decisionGrade}
                        onChange={(e) => setDecisionGrade(e.target.value)}>
                        <option value="">— not recorded —</option>
                        <option>Consultant</option>
                        <option>Registrar</option>
                        <option>SAS</option>
                        <option>Other</option>
                      </select>
                      <p className="mt-1 text-[11px] text-nhs-mid-grey">Grade only — never a name or initials.</p>
                    </div>
                    <div>
                      <label className="label" htmlFor="timeTaken">Time this case took you (minutes, optional)</label>
                      <input id="timeTaken" type="number" min={0} max={240} className="input"
                        placeholder="e.g. 12" value={timeTakenMin}
                        onChange={(e) => setTimeTakenMin(e.target.value)} />
                    </div>
                  </div>
                </section>

                <section className="card border-l-4 border-l-nhs-aqua-blue">
                  <label className="label" htmlFor="finalDiagnosis">
                    Final diagnosis / outcome <span className="text-red-600">*</span>
                  </label>
                  <p className="mb-2 text-xs text-nhs-mid-grey">
                    What did the case turn out to be? (May need a follow-up look-up — histology / final MDT outcome.)
                    This is how we show whether the algorithm actually picks up the cancers.
                  </p>
                  <select id="finalDiagnosis" className="select" value={finalDiagnosis}
                    onChange={(e) => setFinalDiagnosis(e.target.value as FinalDiagnosis)}>
                    <option value="">— select —</option>
                    {FINAL_DIAGNOSES.map((d) => (<option key={d} value={d}>{FINAL_DIAGNOSIS_LABELS[d]}</option>))}
                  </select>
                </section>
              </>
            )}

            {!canCopy && (
              <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
                <strong>Needed before copying:</strong> case ID, reviewer initials, clinic month
                {excluded ? ', exclusion reason.' : ', patient age, actual decision, final diagnosis'}
                {!excluded && actualDecision !== '' && !isConcordant ? ', and (on this mismatch) the discordance reason + direction.' : !excluded ? '.' : ''}
              </div>
            )}

            <button type="button" className="btn-primary w-full justify-center" disabled={!canCopy} onClick={copyRow}>
              <ClipboardCopy className="h-4 w-4" aria-hidden /> Copy row for the audit sheet
            </button>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-4 lg:h-fit">
            <DecisionCard decision={decision} />
            {!excluded && ndLabels.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" role="note">
                <b>This recommendation assumes undocumented items are absent</b> (the standard
                case-note convention). Not documented in the letter:{' '}
                {ndLabels.join(', ')}. Recorded as "ND" in the audit row.
              </div>
            )}
            <PathViewer decision={decision} />
          </aside>
        </div>
      </main>
    </div>
  )
}
