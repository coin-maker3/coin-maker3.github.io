import { cases, modules, moduleLabel, getCase } from '../lib/content.js'
import { allAttempts, latestScores } from '../lib/progress.js'

export default function Stats() {
  const attempts = allAttempts()
  const latest = latestScores()

  // Per-module: latest score per case, averaged
  const rows = modules
    .map((m) => {
      const moduleCases = cases.filter((c) => c.module === m.code)
      const scored = moduleCases.filter((c) => latest[c.id])
      const avg =
        scored.length > 0
          ? scored.reduce((s, c) => s + latest[c.id].score, 0) / scored.length
          : null
      return {
        code: m.code,
        label: m.label,
        total: moduleCases.length,
        done: scored.length,
        avg,
      }
    })
    .filter((r) => r.total > 0)

  const recent = [...attempts].reverse().slice(0, 30)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Stats</h1>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          By module <span className="normal-case">(latest score per case)</span>
        </h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="p-3 font-medium">Module</th>
                <th className="p-3 text-center font-medium">Done</th>
                <th className="p-3 text-right font-medium">Avg /4</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const weak = r.avg !== null && r.avg < 4
                return (
                  <tr key={r.code} className={`border-b border-slate-50 last:border-0 ${weak ? 'bg-amber-50' : ''}`}>
                    <td className="p-3">
                      <span className="font-semibold">{r.code}</span>
                      <span className="ml-1.5 text-slate-500">{r.label}</span>
                    </td>
                    <td className="p-3 text-center text-slate-600">
                      {r.done}/{r.total}
                    </td>
                    <td className={`p-3 text-right font-semibold ${weak ? 'text-amber-700' : 'text-teal-700'}`}>
                      {r.avg !== null ? r.avg.toFixed(1) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 px-1 text-xs text-slate-400">
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-200 align-middle" />
          Modules averaging below 4 — prioritise these.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Recent attempts
        </h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-100">
            No attempts yet — open a case, work through it, and save a self-score.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            {recent.map((a, i) => {
              const c = getCase(a.caseId)
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}
                >
                  <ScorePips score={a.score} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c ? c.title : a.caseId}</p>
                    <p className="text-xs text-slate-400">
                      {c ? `${c.module} · ${moduleLabel(c.module)} · ` : ''}
                      {new Date(a.date).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${a.score < 4 ? 'text-slate-500' : 'text-teal-700'}`}>
                    {a.score}/4
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function ScorePips({ score }) {
  return (
    <div className="flex shrink-0 gap-0.5">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`h-4 w-1.5 rounded-full ${n <= score ? 'bg-teal-600' : 'bg-slate-200'}`}
        />
      ))}
    </div>
  )
}
