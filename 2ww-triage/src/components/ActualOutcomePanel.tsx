import { CheckCircle2, XCircle } from 'lucide-react'
import {
  INVESTIGATIONS,
  INVESTIGATION_LABELS,
  type Investigation,
} from '../algorithm/types'

interface Props {
  toolDecision: Investigation
  actualDecision: Investigation | ''
  onActualChange: (v: Investigation) => void
  notes: string
  onNotesChange: (v: string) => void
  reviewerNotes: string
  onReviewerNotesChange: (v: string) => void
}

export function ActualOutcomePanel({
  toolDecision,
  actualDecision,
  onActualChange,
  notes,
  onNotesChange,
  reviewerNotes,
  onReviewerNotesChange,
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
      </div>

      {actualDecision && !concordant && (
        <div className="mt-3">
          <label className="label" htmlFor="reviewerNotes">
            Reviewer notes — why might tool and clinic differ?
          </label>
          <textarea
            id="reviewerNotes"
            rows={2}
            className="input"
            placeholder="e.g. tool didn't capture comorbidity, clinician deviated for patient preference"
            value={reviewerNotes}
            onChange={(e) => onReviewerNotesChange(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
