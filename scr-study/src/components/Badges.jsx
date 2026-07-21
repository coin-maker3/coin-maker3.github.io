const difficultyStyles = {
  Straightforward: 'bg-emerald-100 text-emerald-800',
  Moderate: 'bg-amber-100 text-amber-800',
  Complex: 'bg-rose-100 text-rose-800',
}

export function DifficultyBadge({ value }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
        difficultyStyles[value] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {value}
    </span>
  )
}

export function ModuleBadge({ code }) {
  return (
    <span className="inline-block rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-800">
      {code}
    </span>
  )
}

export function DoneCheck() {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white"
      title="Attempted"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}
