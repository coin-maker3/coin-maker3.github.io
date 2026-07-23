import { useEffect, useMemo, useState } from 'react'
import { Clipboard, ClipboardCheck } from 'lucide-react'
import type { Intake } from '../schema/intake'
import type { DecisionResult } from '../algorithm/types'
import { buildLetter } from '../letter/template'

interface Props {
  intake: Intake
  decision: DecisionResult
}

export function LetterPanel({ intake, decision }: Props) {
  const letter = useMemo(() => buildLetter(intake, decision), [intake, decision])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-nhs-dark-blue">Clinic letter draft</h3>
        <button type="button" className="btn-secondary" onClick={copy}>
          {copied ? (
            <>
              <ClipboardCheck className="h-4 w-4" aria-hidden /> Copied
            </>
          ) : (
            <>
              <Clipboard className="h-4 w-4" aria-hidden /> Copy
            </>
          )}
        </button>
      </div>
      <p className="mb-3 text-xs text-nhs-mid-grey">
        Identifiers stay as <code className="rounded bg-nhs-pale-grey px-1 text-xs">[Patient Name]</code> / <code className="rounded bg-nhs-pale-grey px-1 text-xs">[DOB]</code> / <code className="rounded bg-nhs-pale-grey px-1 text-xs">[NHS No]</code>. Paste into the Trust Word template and add demographics from your hospital system.
      </p>
      <textarea
        className="input min-h-[420px] font-mono text-xs"
        readOnly
        value={letter}
        aria-label="Clinic letter draft"
      />
    </div>
  )
}
