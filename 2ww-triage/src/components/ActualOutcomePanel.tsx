import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import {
  INVESTIGATIONS,
  INVESTIGATION_LABELS,
  type Investigation,
} from '../algorithm/types'
import {
  DISCORDANCE_REASONS,
  DISCORDANCE_REASON_LABELS,
  DISCORDANCE_DIRECTIONS,
  DISCORDANCE_DIRECTION_LABELS,
  type DiscordanceReason,
  type DiscordanceDirection,
} from '../audit/types'
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
        . Please remove before saving — the audit must not contain PID.
      </div>
    </div>
  )
}

interface Props {
  toolDecision: Investigation
  actualDecision: Investigation | ''
  onActualChange: (v: Investigation) => void
  notes: string
  onNotesChange: (v: string) => void
  reviewerNotes: string
  onReviewerNotesChange: (v: string) => void
  discordanceReason: DiscordanceReason | ''
  onDiscordanceReasonChange: (v: DiscordanceReason | '') => void
  discordanceDirection: DiscordanceDirection | ''
  onDiscordanceDirectionChange: (v: DiscordanceDirection | '') => void
}

export function ActualOutcomePanel({
  toolDecision,
  actualDecision,
  onActualChange,
  notes,
  onNotesChange,
  reviewerNotes,
  onReviewerNotesChange,
  discordanceReason,
  onDiscordanceReasonChange,
  discordanceDirection,
  onDiscordanceDirectionChange,
}: Props) {
  const concordant = actualDecision && actualDecision === toolDecision

  return (
    <div className="card border-l-4 border-l-nhs-warm-yellow">
      <h3 className="text-sm font-semibold text-nhs-dark-blue">
        Audit — actual clinical outcome
      </h3>
      <p className="mt-0.5 text-xs text-nhs-mid-grey">
        From the clinic letter outcome. The tool's recommendation above will be compared.
      </p>

      <div className="mt-3">
        <label className="label" htmlFor="actualDecision">
          What was actually decided in clinic?
        </label>
        <select
          id="actualDecision"
          className="select"
          value={actualDecision}
          onChange={(e) => onActualChange(e.target.value as Investigation)}
        >
          <option value="">— select —</option>
          {INVESTIGATIONS.map((inv) => (
            <option key={inv} value={inv}>
              {INVESTIGATION_LABELS[inv]}
            </option>
          ))}
        </select>
      </div>

      {actualDecision && (
        <div
          className={`mt-3 rounded-md p-3 text-sm ${
            concordant ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'
          }`}
        >
          {concordant ? (
            <>
              <CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden />
              <strong>Concordant</strong> — tool and clinician agree.
            </>
          ) : (
            <>
              <XCircle className="mr-1 inline h-4 w-4" aria-hidden />
              <strong>Mismatch.</strong> Tool: {INVESTIGATION_LABELS[toolDecision]}. Clinic: {INVESTIGATION_LABELS[actualDecision]}. Document the reason below.
            </>
          )}
        </div>
      )}

      <div className="mt-3">
        <label className="label" htmlFor="actualNotes">
          Outcome notes (optional)
        </label>
        <textarea
          id="actualNotes"
          rows={2}
          className="input"
          placeholder="e.g. consultant override, patient declined, MDT discussion outcome"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
        />
        <PidWarning text={notes} />
      </div>

      {actualDecision && !concordant && (
        <div className="mt-3 space-y-3 rounded-md border border-amber-200 bg-amber-50/40 p-3">
          <div>
            <label className="label" htmlFor="discordanceReason">
              Why did they differ? <span className="text-red-600">*</span>
            </label>
            <select
              id="discordanceReason"
              className="select"
              value={discordanceReason}
              onChange={(e) => onDiscordanceReasonChange(e.target.value as DiscordanceReason | '')}
            >
              <option value="">— select —</option>
              {DISCORDANCE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {DISCORDANCE_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="discordanceDirection">
              Direction — depth of investigation <span className="text-red-600">*</span>
            </label>
            <select
              id="discordanceDirection"
              className="select"
              value={discordanceDirection}
              onChange={(e) =>
                onDiscordanceDirectionChange(e.target.value as DiscordanceDirection | '')
              }
            >
              <option value="">— select —</option>
              {DISCORDANCE_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {DISCORDANCE_DIRECTION_LABELS[d]}
                </option>
              ))}
            </select>
            {discordanceDirection === 'clinician_less' && (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-red-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Clinician investigated less than the protocol recommended — a potential
                under-investigation. Flag for senior review.
              </p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="reviewerNotes">
              Reviewer notes (optional detail)
            </label>
            <textarea
              id="reviewerNotes"
              rows={2}
              className="input"
              placeholder="e.g. tool didn't capture comorbidity, clinician deviated for patient preference"
              value={reviewerNotes}
              onChange={(e) => onReviewerNotesChange(e.target.value)}
            />
            <PidWarning text={reviewerNotes} />
          </div>
        </div>
      )}
    </div>
  )
}
