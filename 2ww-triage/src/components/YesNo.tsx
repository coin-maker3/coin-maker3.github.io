import type { YesNo as YN } from '../schema/intake'

interface Props {
  value: YN
  onChange: (v: YN) => void
  includeUnknown?: boolean
  id?: string
  label?: string
}

const OPTIONS: { value: YN; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'Unknown' },
]

export function YesNoToggle({ value, onChange, includeUnknown, id, label }: Props) {
  const opts = includeUnknown ? OPTIONS : OPTIONS.slice(0, 2)
  return (
    <div className="toggle-yn" role="group" aria-labelledby={id} aria-label={label}>
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
