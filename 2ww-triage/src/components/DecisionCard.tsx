import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { INVESTIGATION_LABELS, type DecisionResult } from '../algorithm/types'

interface Props {
  decision: DecisionResult
}

export function DecisionCard({ decision }: Props) {
  return (
    <div className="card border-l-4 border-l-nhs-blue">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-nhs-mid-grey">
        Recommended investigation
      </div>
      <h3 className="mb-3 text-2xl font-semibold text-nhs-dark-blue">
        <CheckCircle2 className="mr-2 inline h-6 w-6 text-nhs-green" aria-hidden />
        {INVESTIGATION_LABELS[decision.investigation]}
      </h3>

      <p className="mb-4 text-sm text-nhs-black">{decision.rationale}</p>

      {decision.warnings.length > 0 && (
        <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden />
          <span className="font-medium">Caveats:</span>
          <ul className="ml-6 mt-1 list-disc">
            {decision.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {decision.alternatives.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-1 text-sm font-semibold text-nhs-dark-grey">
            Alternatives to consider
          </h4>
          <ul className="ml-4 list-disc space-y-1 text-sm">
            {decision.alternatives.map((a, i) => (
              <li key={i}>
                <span className="font-medium">{INVESTIGATION_LABELS[a.investigation]}</span> — {a.when}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-gray-100 pt-3 text-xs text-nhs-mid-grey">
        Algorithm:{' '}
        <code className="rounded bg-nhs-pale-grey px-1.5 py-0.5">
          {decision.algorithm.id} v{decision.algorithm.version}
        </code>{' '}
        · node{' '}
        <code className="rounded bg-nhs-pale-grey px-1.5 py-0.5">
          {decision.algorithmNodeId}
        </code>{' '}
        · {new Date(decision.computedAt).toLocaleString('en-GB')}
      </div>
    </div>
  )
}
