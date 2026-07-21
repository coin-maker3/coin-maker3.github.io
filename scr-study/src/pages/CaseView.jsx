import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { cases, getCase, caseIndex, moduleLabel } from '../lib/content.js'
import { saveScore, setLastCase, attemptsFor } from '../lib/progress.js'
import Markdown from '../components/Markdown.jsx'
import { DifficultyBadge, ModuleBadge } from '../components/Badges.jsx'
import { SpfChips } from '../components/Spf.jsx'
import { spfEntry } from '../lib/content.js'

export default function CaseView() {
  const { id } = useParams()
  const c = getCase(id)
  const [revealed, setRevealed] = useState([])
  const [attempts, setAttempts] = useState([])
  const [justSaved, setJustSaved] = useState(null)

  useEffect(() => {
    setRevealed([])
    setJustSaved(null)
    if (c) {
      setLastCase(c.id)
      setAttempts(attemptsFor(c.id))
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">Case not found.</p>
        <Link to="/cases" className="mt-2 inline-block font-medium text-teal-700">
          Back to cases
        </Link>
      </div>
    )
  }

  const idx = caseIndex(c.id)
  const prev = idx > 0 ? cases[idx - 1] : null
  const next = idx < cases.length - 1 ? cases[idx + 1] : null
  const allRevealed = c.domains.every((d) => revealed.includes(d.n))

  const reveal = (n) => setRevealed((r) => (r.includes(n) ? r : [...r, n]))
  const revealAll = () => setRevealed(c.domains.map((d) => d.n))

  const handleScore = (score, spfTicked) => {
    saveScore(c.id, score, spfTicked)
    setAttempts(attemptsFor(c.id))
    setJustSaved(score)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/cases" className="text-sm font-medium text-teal-700">
          ← Cases
        </Link>
        <h1 className="mt-2 text-xl font-bold leading-snug tracking-tight">{c.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ModuleBadge code={c.module} />
          <span className="text-xs text-slate-500">{moduleLabel(c.module)}</span>
          <DifficultyBadge value={c.difficulty} />
        </div>
      </div>

      {/* Stem — always visible */}
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Scenario
        </h2>
        <Markdown>{c.stem}</Markdown>
        {c.spf_codes?.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              SPF codes in this case — tap to decode
            </p>
            <SpfChips codes={c.spf_codes} />
          </div>
        )}
      </section>

      <p className="px-1 text-sm text-slate-500">
        Say your answer for each domain <strong>out loud first</strong>, then reveal the model
        answer to compare.
      </p>

      {!allRevealed && (
        <button
          onClick={revealAll}
          className="w-full rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 active:bg-slate-100"
        >
          Reveal all domains
        </button>
      )}

      {/* Domains — collapsed behind reveal buttons */}
      {c.domains.map((d) => (
        <DomainCard key={d.n} domain={d} isRevealed={revealed.includes(d.n)} onReveal={() => reveal(d.n)} />
      ))}

      {/* Post-reveal material */}
      {allRevealed && (
        <>
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-700">
              Where marks are lost
            </h2>
            <ul className="space-y-1.5 text-sm text-rose-900">
              {c.marks_lost?.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 shrink-0">✗</span>
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </section>

          {c.probes?.length > 0 && (
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Examiner probes
              </h2>
              <p className="mb-3 text-xs text-slate-400">Tap a question to reveal the answer.</p>
              <div className="space-y-2">
                {c.probes.map((p, i) => (
                  <Probe key={i} q={p.q} a={p.a} />
                ))}
              </div>
            </section>
          )}

          {c.references?.length > 0 && (
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                References
              </h2>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
                {c.references.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          <ScoreWidget
            attempts={attempts}
            justSaved={justSaved}
            onScore={handleScore}
            spfCodes={c.spf_codes ?? []}
          />
        </>
      )}

      {/* Prev / next */}
      <div className="flex gap-3 pt-2">
        {prev ? (
          <Link
            to={`/cases/${prev.id}`}
            className="flex-1 rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 active:bg-slate-50"
          >
            <p className="text-xs text-slate-400">← Previous</p>
            <p className="mt-0.5 truncate text-sm font-medium">{prev.title}</p>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
        {next ? (
          <Link
            to={`/cases/${next.id}`}
            className="flex-1 rounded-xl bg-white p-3 text-right shadow-sm ring-1 ring-slate-100 active:bg-slate-50"
          >
            <p className="text-xs text-slate-400">Next →</p>
            <p className="mt-0.5 truncate text-sm font-medium">{next.title}</p>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  )
}

function DomainCard({ domain, isRevealed, onReveal }) {
  // Domain 4 (professionalism/ethics/medicolegal) is the exam's weak-spot domain — subtle accent.
  const isD4 = domain.n === 4
  const ring = isD4 ? 'ring-violet-200' : 'ring-slate-100'
  const headerColor = isD4 ? 'text-violet-700' : 'text-slate-500'

  if (!isRevealed) {
    return (
      <button
        onClick={onReveal}
        className={`w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 active:bg-slate-50 ${ring}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${headerColor}`}>
              Domain {domain.n}
            </p>
            <p className="mt-0.5 text-sm font-medium text-slate-700">{domain.name}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-white ${
              isD4 ? 'bg-violet-600' : 'bg-teal-700'
            }`}
          >
            Reveal
          </span>
        </div>
      </button>
    )
  }

  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${ring} ${isD4 ? 'border-l-4 border-violet-400' : ''}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${headerColor}`}>
        Domain {domain.n}
      </p>
      <p className="mt-0.5 mb-3 text-sm font-medium text-slate-700">{domain.name}</p>
      <Markdown className="prose-sm">{domain.model_answer}</Markdown>
      {domain.spf_codes?.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <SpfChips codes={domain.spf_codes} />
        </div>
      )}
    </section>
  )
}

function Probe({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="w-full rounded-xl bg-slate-50 p-3 text-left ring-1 ring-slate-100 active:bg-slate-100"
    >
      <p className="text-sm font-medium text-slate-800">{q}</p>
      {open && <p className="mt-2 border-t border-slate-200 pt-2 text-sm text-slate-600">{a}</p>}
      {!open && <p className="mt-1 text-xs text-teal-700">Show answer</p>}
    </button>
  )
}

function ScoreWidget({ attempts, justSaved, onScore, spfCodes }) {
  const [ticked, setTicked] = useState([])
  const last = attempts.length > 0 ? attempts[attempts.length - 1] : null

  const toggle = (code) =>
    setTicked((t) => (t.includes(code) ? t.filter((c) => c !== code) : [...t, code]))

  return (
    <section className="rounded-2xl bg-teal-50 p-4 ring-1 ring-teal-100">
      <h2 className="text-sm font-semibold text-teal-900">Self-score this attempt</h2>

      {spfCodes.length > 0 && (
        <>
          <p className="mt-2 text-xs text-teal-800">
            SPF codes — did I demonstrate this <strong>out loud</strong>?
          </p>
          <div className="mt-2 space-y-1.5">
            {spfCodes.map((code) => {
              const entry = spfEntry(code)
              const on = ticked.includes(code)
              return (
                <button
                  key={code}
                  onClick={() => toggle(code)}
                  className={`flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left ring-1 transition-colors ${
                    on ? 'bg-teal-700 ring-teal-700' : 'bg-white ring-teal-200 active:bg-teal-100'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ${
                      on ? 'bg-white text-teal-700 ring-white' : 'bg-white text-transparent ring-teal-300'
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className={`text-xs font-bold ${on ? 'text-white' : 'text-teal-900'}`}>
                      {code}
                    </span>
                    <span className={`block text-xs leading-snug ${on ? 'text-teal-100' : 'text-slate-500'}`}>
                      {entry?.outcome ?? 'Not in the decode table yet'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-teal-800">
        Domains I covered unprompted (before revealing) — tap to save the attempt:
      </p>
      <div className="mt-2 flex gap-2">
        {[0, 1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => onScore(n, ticked)}
            className={`flex-1 rounded-xl py-3 text-lg font-bold transition-colors ${
              justSaved === n
                ? 'bg-teal-700 text-white'
                : 'bg-white text-teal-800 ring-1 ring-teal-200 active:bg-teal-100'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {justSaved !== null ? (
        <p className="mt-3 text-xs font-medium text-teal-800">
          Saved {justSaved}/4
          {spfCodes.length > 0 ? ` with ${ticked.length}/${spfCodes.length} codes` : ''} —{' '}
          {new Date().toLocaleDateString()}
        </p>
      ) : last ? (
        <p className="mt-3 text-xs text-teal-700">
          Last attempt: {last.score}/4 on {new Date(last.date).toLocaleDateString()}
          {attempts.length > 1 ? ` · ${attempts.length} attempts total` : ''}
        </p>
      ) : null}
    </section>
  )
}
