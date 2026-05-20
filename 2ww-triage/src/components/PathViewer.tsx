import { ChevronRight } from 'lucide-react'
import type { DecisionResult } from '../algorithm/types'

export function PathViewer({ decision }: { decision: DecisionResult }) {
  return (
    <details className="card">
      <summary className="cursor-pointer text-sm font-semibold text-nhs-dark-blue">
        Show algorithm path ({decision.path.length} steps)
      </summary>
      <ol className="mt-4 space-y-3">
        {decision.path.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-nhs-mid-grey" aria-hidden />
            <div className="flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <code className="rounded bg-nhs-pale-grey px-1.5 py-0.5 text-xs font-medium">
                  {step.nodeId}
                </code>
                <span className="text-sm font-medium text-nhs-black">{step.label}</span>
              </div>
              {step.evidence && (
                <p className="mt-0.5 text-xs text-nhs-mid-grey">→ {step.evidence}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </details>
  )
}
