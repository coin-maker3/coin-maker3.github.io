import type { YesNo as YN } from '../schema/intake'

interface Props {
  value: YN
  onChange: (v: YN) => void
  includeUnknown?: boolean
  id?: string
  label?: string
  /** Renders a third "Not documented" option (Mr Wanigasooriya, Jul 2026): the
   *  truthful answer when the letter is silent. Selecting it stores 'no' via
   *  onChange — the declared convention "not documented computes as absent" —
   *  while the ND flag rides alongside for the audit row and on-screen caveat,
   *  so the RECORD stays honest and the ALGORITHM stays the signed-off one. */
  nd?: boolean
  onNd?: (nd: boolean) => void
}

const OPTIONS: { value: YN; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
]

export function YesNoToggle({ value, onChange, includeUnknown, id, label, nd, onNd }: Props) {
  const opts = includeUnknown ? OPTIONS : OPTIONS.slice(0, 2)
  return (
    <div className="toggle-yn" role="group" aria-labelledby={id} aria-label={label}>
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={!nd && value === o.value}
          onClick={() => {
            onNd?.(false)
            onChange(o.value)
          }}
        >
          {o.label}
        </button>
      ))}
      {onNd && (
        <button
          type="button"
          className="nd"
          aria-pressed={!!nd}
          onClick={() => {
            onNd(true)
            onChange('no')
          }}
        >
          Not documented
        </button>
      )}
    </div>
  )
}
