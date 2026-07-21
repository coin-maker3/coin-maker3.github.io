import { useState } from 'react'
import { spfEntry } from '../lib/content.js'

export const spfDomainStyles = {
  Clinical: 'bg-teal-50 text-teal-800 ring-teal-200',
  Communication: 'bg-sky-50 text-sky-800 ring-sky-200',
  Professionalism: 'bg-violet-50 text-violet-800 ring-violet-200',
  'Management and leadership': 'bg-amber-50 text-amber-800 ring-amber-200',
}

export function chipStyle(code) {
  const domain = spfEntry(code)?.domain
  return spfDomainStyles[domain] ?? 'bg-slate-50 text-slate-700 ring-slate-200'
}

// Tappable SPF code chips with a self-contained bottom-sheet decode.
export function SpfChips({ codes }) {
  const [openCode, setOpenCode] = useState(null)
  if (!codes || codes.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {codes.map((code) => (
          <button
            key={code}
            onClick={() => setOpenCode(code)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${chipStyle(code)}`}
          >
            {code}
          </button>
        ))}
      </div>
      {openCode && <SpfSheet code={openCode} onClose={() => setOpenCode(null)} />}
    </>
  )
}

export function SpfSheet({ code, onClose }) {
  const entry = spfEntry(code)
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl rounded-t-3xl bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${chipStyle(code)}`}>
            {code}
          </span>
          <span className="text-xs font-medium text-slate-500">
            {entry?.domain ?? 'Unknown code'}
          </span>
        </div>
        {entry ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-slate-800">{entry.outcome}</p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                What it sounds like out loud
              </p>
              <p className="mt-1 text-sm italic leading-relaxed text-slate-600">{entry.say_it}</p>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No entry for this code yet — add it to <code>src/content/spf.json</code>.
          </p>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 active:bg-slate-200"
        >
          Close
        </button>
      </div>
    </div>
  )
}
