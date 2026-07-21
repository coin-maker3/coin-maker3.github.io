import { Link } from 'react-router-dom'
import { cases, sheets, getCase } from '../lib/content.js'
import { latestScores, getLastCase } from '../lib/progress.js'
import { ModuleBadge } from '../components/Badges.jsx'

export default function Home() {
  const scores = latestScores()
  const done = Object.keys(scores).filter((id) => getCase(id)).length
  const scoreValues = Object.entries(scores)
    .filter(([id]) => getCase(id))
    .map(([, a]) => a.score)
  const avg =
    scoreValues.length > 0
      ? (scoreValues.reduce((s, v) => s + v, 0) / scoreValues.length).toFixed(1)
      : null

  const lastId = getLastCase()
  const lastCase = lastId ? getCase(lastId) : null

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">SCR Study</h1>
        <p className="mt-1 text-sm text-slate-500">
          LDS Part 2 · Structured Clinical Reasoning
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-3xl font-bold text-teal-700">
            {done}
            <span className="text-base font-medium text-slate-400"> / {cases.length}</span>
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">cases attempted</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-3xl font-bold text-teal-700">
            {avg ?? '—'}
            {avg && <span className="text-base font-medium text-slate-400"> / 4</span>}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">avg self-score</p>
        </div>
      </section>

      {lastCase && (
        <Link
          to={`/cases/${lastCase.id}`}
          className="block rounded-2xl bg-teal-700 p-4 text-white shadow-sm active:bg-teal-800"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-teal-100">
            Continue where you left off
          </p>
          <p className="mt-1 flex items-center gap-2 font-semibold">
            <ModuleBadge code={lastCase.module} /> {lastCase.title}
          </p>
        </Link>
      )}

      <section className="space-y-3">
        <HomeLink
          to="/cases"
          title="Cases"
          desc={`${cases.length} worked cases — drill mode, domain by domain`}
        />
        <HomeLink
          to="/sheets"
          title="Knowledge sheets"
          desc={`${sheets.length} one-page revision sheets`}
        />
        <HomeLink
          to="/protocol"
          title="Answer protocol"
          desc="The five-beat structure for every SCR answer"
        />
        <HomeLink to="/stats" title="Stats" desc="Self-scores over time, per module" />
      </section>
    </div>
  )
}

function HomeLink({ to, title, desc }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 active:bg-slate-50"
    >
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-slate-500">{desc}</p>
      </div>
      <svg
        className="h-5 w-5 shrink-0 text-slate-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
