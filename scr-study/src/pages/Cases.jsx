import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cases, modules, moduleLabel, DIFFICULTIES } from '../lib/content.js'
import { latestScores } from '../lib/progress.js'
import { DifficultyBadge, DoneCheck } from '../components/Badges.jsx'

export default function Cases() {
  const [moduleFilter, setModuleFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const scores = latestScores()

  const filtered = cases.filter(
    (c) =>
      (moduleFilter === 'all' || c.module === moduleFilter) &&
      (difficultyFilter === 'all' || c.difficulty === difficultyFilter),
  )

  // Group by module, preserving modules.json order
  const groups = modules
    .map((m) => ({ module: m, items: filtered.filter((c) => c.module === m.code) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Cases</h1>

      <div className="space-y-2">
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex w-max gap-1.5 pb-1">
            <FilterChip
              active={moduleFilter === 'all'}
              onClick={() => setModuleFilter('all')}
              label="All modules"
            />
            {modules.map((m) => (
              <FilterChip
                key={m.code}
                active={moduleFilter === m.code}
                onClick={() => setModuleFilter(moduleFilter === m.code ? 'all' : m.code)}
                label={m.code}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-1.5">
          <FilterChip
            active={difficultyFilter === 'all'}
            onClick={() => setDifficultyFilter('all')}
            label="Any difficulty"
          />
          {DIFFICULTIES.map((d) => (
            <FilterChip
              key={d}
              active={difficultyFilter === d}
              onClick={() => setDifficultyFilter(difficultyFilter === d ? 'all' : d)}
              label={d}
            />
          ))}
        </div>
      </div>

      {groups.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">No cases match these filters.</p>
      )}

      {groups.map(({ module: m, items }) => (
        <section key={m.code}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {m.code} · {moduleLabel(m.code)}
          </h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
            {items.map((c, i) => (
              <Link
                key={c.id}
                to={`/cases/${c.id}`}
                className={`flex items-center gap-3 p-4 active:bg-slate-50 ${
                  i > 0 ? 'border-t border-slate-100' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.title}</p>
                  <div className="mt-1">
                    <DifficultyBadge value={c.difficulty} />
                  </div>
                </div>
                {scores[c.id] && <DoneCheck />}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-teal-700 text-white'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 active:bg-slate-100'
      }`}
    >
      {label}
    </button>
  )
}
