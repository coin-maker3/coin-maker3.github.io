import { useState } from 'react'
import { spf, spfDomains } from '../lib/content.js'
import { chipStyle } from '../components/Spf.jsx'

export default function Codes() {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const matches = (e) =>
    !q ||
    e.code.toLowerCase().includes(q) ||
    e.domain.toLowerCase().includes(q) ||
    e.outcome.toLowerCase().includes(q) ||
    e.say_it.toLowerCase().includes(q)

  const groups = spfDomains
    .map((domain) => ({ domain, items: spf.filter((e) => e.domain === domain && matches(e)) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SPF codes</h1>
        <p className="mt-1 text-sm text-slate-500">
          The decode table — what each code means and what saying it out loud sounds like.
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search codes, outcomes, phrases…"
        className="w-full rounded-xl border-0 bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
      />

      {groups.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">No codes match “{query}”.</p>
      )}

      {groups.map(({ domain, items }) => (
        <section key={domain}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {domain}
          </h2>
          <div className="space-y-2">
            {items.map((e) => (
              <div key={e.code} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${chipStyle(e.code)}`}>
                  {e.code}
                </span>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-800">{e.outcome}</p>
                <p className="mt-2 border-l-2 border-slate-200 pl-3 text-sm italic leading-relaxed text-slate-500">
                  {e.say_it}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
