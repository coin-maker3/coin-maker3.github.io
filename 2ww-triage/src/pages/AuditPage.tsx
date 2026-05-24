import { Fragment, useEffect, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { deleteAuditCase, listAuditCases } from '../lib/audit-api'
import {
  buildSummary,
  duplicateIdSet,
  exportCSV,
  findPossibleDuplicates,
  type AuditCase,
  type AuditSummary,
  type DuplicateGroup,
} from '../audit/types'
import { INVESTIGATION_LABELS } from '../algorithm/types'
import { linkTo } from '../lib/router'

export function AuditPage() {
  const [cases, setCases] = useState<AuditCase[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'match' | 'mismatch' | 'duplicates'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = () => {
    setError(null)
    listAuditCases()
      .then((list) => setCases(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      .catch((e) => setError(e.message ?? 'Failed to load'))
  }

  useEffect(load, [])

  const onDelete = async (id: string) => {
    if (!confirm(`Delete ${id}? This cannot be undone.`)) return
    await deleteAuditCase(id)
    load()
  }

  const onExport = () => {
    if (!cases) return
    const csv = exportCSV(cases)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `2ww-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const summary: AuditSummary | null = cases ? buildSummary(cases) : null
  const duplicates: DuplicateGroup[] = cases ? findPossibleDuplicates(cases) : []
  const dupIds = duplicateIdSet(duplicates)
  const filtered = cases?.filter((c) => {
    if (filter === 'match') return c.concordant
    if (filter === 'mismatch') return !c.concordant
    if (filter === 'duplicates') return dupIds.has(c.id)
    return true
  })

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-nhs-dark-blue">2WW Concordance Audit</h1>
            <p className="text-xs text-nhs-mid-grey">
              George Eliot Hospital · FY1-entered, anonymised
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a className="btn-secondary" href={linkTo.clinician()}>
              Clinician tool
            </a>
            <a className="btn-primary" href={linkTo.auditNew()}>
              <Plus className="h-4 w-4" aria-hidden /> New case
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        {summary && summary.stopCriteria && (summary.stopCriteria.overallTriggered || summary.stopCriteria.armsTriggered.length > 0) && (
          <section className="card border-l-4 border-l-red-600 bg-red-50">
            <h2 className="text-sm font-bold text-red-900">
              ⚠ STOP-CRITERIA TRIGGERED — per protocol § 17, pause audit and review
            </h2>
            {summary.stopCriteria.overallReason && (
              <p className="mt-1 text-xs text-red-900">• {summary.stopCriteria.overallReason}</p>
            )}
            {summary.stopCriteria.armsTriggered.map((a) => (
              <p key={a.label} className="mt-1 text-xs text-red-900">
                • Arm "{a.label}" concordance {a.concordancePct}% with N={a.total} (≥5 case threshold) — &lt; 50% requires defect review
              </p>
            ))}
          </section>
        )}

        {summary && (
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-nhs-mid-grey">Cases</div>
              <div className="mt-1 text-3xl font-bold text-nhs-dark-blue">{summary.total}</div>
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-nhs-mid-grey">Concordance (primary)</div>
              <div className="mt-1 text-3xl font-bold text-nhs-green">{summary.concordancePct}%</div>
              <div className="text-xs text-nhs-mid-grey">
                {summary.concordant} of {summary.total} ·{' '}
                95% CI {Math.round(summary.ci95.lo * 100)}–{Math.round(summary.ci95.hi * 100)}%
              </div>
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-nhs-mid-grey">Cohen's κ</div>
              {summary.kappa ? (
                <>
                  <div className="mt-1 text-3xl font-bold text-nhs-dark-blue">
                    {summary.kappa.kappa.toFixed(2)}
                  </div>
                  <div className="text-xs text-nhs-mid-grey">
                    95% CI {summary.kappa.ciLo.toFixed(2)} – {summary.kappa.ciHi.toFixed(2)}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm text-nhs-mid-grey">awaiting cases</div>
              )}
            </div>
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-nhs-mid-grey">Possible duplicates</div>
              <div className={`mt-1 text-3xl font-bold ${dupIds.size ? 'text-amber-600' : 'text-nhs-mid-grey'}`}>
                {dupIds.size}
              </div>
              <div className="text-xs text-nhs-mid-grey">
                {duplicates.length} group{duplicates.length === 1 ? '' : 's'}
              </div>
            </div>
          </section>
        )}

        {summary && summary.byFy1.length > 0 && (
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-nhs-dark-blue">Per-FY1 progress</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {summary.byFy1.map((r) => (
                <div key={r.enteredBy} className="rounded border border-gray-200 p-3">
                  <div className="text-sm font-mono font-medium">{r.enteredBy}</div>
                  <div className="text-xs text-nhs-mid-grey">
                    {r.total} cases · {r.concordancePct}% concordance
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded bg-gray-100">
                    <div
                      className="h-full bg-nhs-blue"
                      style={{ width: `${Math.min(100, (r.total / 100) * 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-nhs-mid-grey">target 100/FY1</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {summary && summary.timeStats && (
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-nhs-dark-blue">Time per case (seconds)</h2>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              <div><span className="text-nhs-mid-grey">N entered:</span> {summary.timeStats.n}</div>
              <div><span className="text-nhs-mid-grey">Mean:</span> {summary.timeStats.mean}s</div>
              <div><span className="text-nhs-mid-grey">Q1:</span> {summary.timeStats.q1}s</div>
              <div><span className="text-nhs-mid-grey">Median:</span> {summary.timeStats.median}s</div>
              <div><span className="text-nhs-mid-grey">Q3:</span> {summary.timeStats.q3}s</div>
            </div>
          </section>
        )}

        {duplicates.length > 0 && (
          <section className="card border-l-4 border-l-amber-500 bg-amber-50">
            <h2 className="text-sm font-semibold text-amber-900">
              ⚠ {dupIds.size} cases in {duplicates.length} possible-duplicate group{duplicates.length === 1 ? '' : 's'}
            </h2>
            <p className="mt-1 text-xs text-amber-900">
              Same clinic month + demographics + referral reasons + banded bloods + symptoms.
              Could be two FY1s on the same letter, or one letter entered twice. Resolve before analysis.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {duplicates.slice(0, 10).map((g, idx) => (
                <li key={idx} className="rounded border border-amber-200 bg-white p-2">
                  <div className="text-xs font-medium text-amber-900">
                    {g.crossFy1 ? 'Cross-FY1 duplicate' : 'Same-FY1 duplicate'}:
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-2">
                    {g.cases.map((c) => (
                      <span key={c.id} className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs">
                        {c.id} ({c.enteredBy})
                      </span>
                    ))}
                  </div>
                </li>
              ))}
              {duplicates.length > 10 && (
                <li className="text-xs text-amber-900">…and {duplicates.length - 10} more</li>
              )}
            </ul>
          </section>
        )}

        {summary && summary.byArm.length > 0 && (
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-nhs-dark-blue">Concordance by algorithm arm</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summary.byArm.map((arm) => (
                <div key={arm.nodeIdPrefix} className="rounded border border-gray-200 p-3">
                  <div className="text-sm font-medium">{arm.label}</div>
                  <div className="text-xs text-nhs-mid-grey">
                    {arm.concordant}/{arm.total} = {arm.concordancePct}%
                  </div>
                  <div className="text-[11px] text-nhs-mid-grey">
                    95% CI {Math.round(arm.ci95.lo * 100)}–{Math.round(arm.ci95.hi * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {summary && summary.confusion.rowLabels.length > 0 && (
          <section className="card overflow-x-auto">
            <h2 className="mb-3 text-sm font-semibold text-nhs-dark-blue">
              Confusion matrix — tool decision (rows) × actual decision (columns)
            </h2>
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Tool ↓ / Actual →</th>
                  {summary.confusion.colLabels.map((c) => (
                    <th key={c} className="px-2 py-1 text-center">{INVESTIGATION_LABELS[c]}</th>
                  ))}
                  <th className="px-2 py-1 text-center font-bold">Row total</th>
                </tr>
              </thead>
              <tbody>
                {summary.confusion.rowLabels.map((r) => (
                  <tr key={r} className="border-t border-gray-100">
                    <td className="px-2 py-1 font-medium">{INVESTIGATION_LABELS[r]}</td>
                    {summary.confusion.colLabels.map((c) => {
                      const n = summary.confusion.cells[`${r}|${c}`] ?? 0
                      const isDiag = r === c
                      return (
                        <td
                          key={c}
                          className={`px-2 py-1 text-center ${isDiag ? 'bg-green-50 font-semibold text-green-900' : n > 0 ? 'bg-amber-50 text-amber-900' : 'text-nhs-mid-grey'}`}
                        >
                          {n}
                        </td>
                      )
                    })}
                    <td className="px-2 py-1 text-center font-bold">
                      {summary.confusion.rowTotals[r] ?? 0}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-gray-200">
                  <td className="px-2 py-1 font-bold">Column total</td>
                  {summary.confusion.colLabels.map((c) => (
                    <td key={c} className="px-2 py-1 text-center font-bold">
                      {summary.confusion.colTotals[c] ?? 0}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-center font-bold">{summary.total}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-nhs-mid-grey">
              Diagonal cells (green) = concordant. Off-diagonal cells (amber) = mismatch — the tool said the row, the clinic did the column.
            </p>
          </section>
        )}

        {summary && (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SubgroupCard title="By referral reason" rows={summary.subgroups.byReferralReason} />
            <SubgroupCard title="By age band" rows={summary.subgroups.byAgeBand} />
            <SubgroupCard title="By bowel-prep fitness" rows={summary.subgroups.byBowelPrepFit} />
          </section>
        )}

        {summary && summary.mismatchPatterns.length > 0 && (
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-nhs-dark-blue">Top mismatch patterns</h2>
            <ul className="space-y-1 text-sm">
              {summary.mismatchPatterns.slice(0, 8).map((m) => (
                <li key={`${m.toolDecision}->${m.actualDecision}`}>
                  <strong>{m.count}×</strong>{' '}
                  Tool said <em>{INVESTIGATION_LABELS[m.toolDecision]}</em>, clinic did{' '}
                  <em>{INVESTIGATION_LABELS[m.actualDecision]}</em>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-nhs-dark-blue">All cases</h2>
            <div className="flex items-center gap-2">
              <select
                className="select"
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="match">Concordant only</option>
                <option value="mismatch">Mismatches only</option>
                <option value="duplicates">Possible duplicates</option>
              </select>
              <button
                type="button"
                className="btn-secondary"
                onClick={onExport}
                disabled={!cases?.length}
              >
                <Download className="h-4 w-4" aria-hidden /> Export CSV
              </button>
            </div>
          </div>
          {filtered && filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-nhs-mid-grey">
              No cases yet. Click "New case" to enter the first one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-nhs-mid-grey">
                  <tr>
                    <th className="py-2 pr-3">ID</th>
                    <th className="py-2 pr-3">FY1</th>
                    <th className="py-2 pr-3">Month</th>
                    <th className="py-2 pr-3">Tool</th>
                    <th className="py-2 pr-3">Actual</th>
                    <th className="py-2 pr-3">Match</th>
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered?.map((c) => {
                    const isExpanded = expandedId === c.id
                    return (
                      <Fragment key={c.id}>
                        <tr className="border-b border-gray-100 last:border-0">
                          <td className="py-2 pr-3 font-mono text-xs">
                            <button
                              type="button"
                              className="mr-1 text-nhs-blue hover:underline"
                              onClick={() => setExpandedId(isExpanded ? null : c.id)}
                              aria-label={isExpanded ? 'Hide reasoning' : 'Show reasoning'}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                            {c.id}
                            {dupIds.has(c.id) && (
                              <span
                                className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                                title="Possible duplicate"
                              >
                                DUP?
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3">{c.enteredBy}</td>
                          <td className="py-2 pr-3">{c.clinicMonth}</td>
                          <td className="py-2 pr-3">{INVESTIGATION_LABELS[c.toolDecision.investigation]}</td>
                          <td className="py-2 pr-3">{INVESTIGATION_LABELS[c.actualDecision]}</td>
                          <td className="py-2 pr-3">
                            {c.concordant ? (
                              <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">✓</span>
                            ) : (
                              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">✗</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-xs text-nhs-mid-grey">
                            {c.timeTakenSeconds ? `${c.timeTakenSeconds}s` : '—'}
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <button
                              type="button"
                              className="text-xs text-nhs-warm-red hover:underline"
                              onClick={() => onDelete(c.id)}
                              aria-label={`Delete ${c.id}`}
                            >
                              <Trash2 className="inline h-3 w-3" aria-hidden /> Delete
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-gray-100 bg-gray-50">
                            <td colSpan={8} className="px-3 py-3">
                              <div className="grid grid-cols-1 gap-3 text-xs lg:grid-cols-2">
                                <div>
                                  <div className="mb-1 font-semibold text-nhs-dark-blue">
                                    How the tool reached this recommendation
                                  </div>
                                  <ol className="space-y-1 list-decimal pl-4">
                                    {(c.toolDecision.path ?? []).map((step, i) => (
                                      <li key={i}>
                                        <span className="font-mono text-[10px] text-nhs-mid-grey">{step.nodeId}</span>{' '}
                                        — {step.label}
                                        {step.evidence && (
                                          <div className="ml-1 text-[11px] italic text-nhs-mid-grey">
                                            evidence: {step.evidence}
                                          </div>
                                        )}
                                      </li>
                                    ))}
                                  </ol>
                                  <div className="mt-2">
                                    <span className="font-semibold">Rationale: </span>
                                    {c.toolDecision.rationale}
                                  </div>
                                  {c.toolDecision.warnings && c.toolDecision.warnings.length > 0 && (
                                    <div className="mt-2 rounded bg-amber-50 p-2">
                                      <span className="font-semibold text-amber-900">Engine warnings: </span>
                                      <ul className="list-disc pl-4 text-amber-900">
                                        {c.toolDecision.warnings.map((w, i) => (
                                          <li key={i}>{w}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  <div className="mt-2 text-[11px] text-nhs-mid-grey">
                                    Algorithm version: {c.toolDecision.algorithmVersion}
                                  </div>
                                </div>
                                <div>
                                  <div className="mb-1 font-semibold text-nhs-dark-blue">Outcome &amp; notes</div>
                                  <div>
                                    <span className="font-semibold">Actual decision: </span>
                                    {INVESTIGATION_LABELS[c.actualDecision]}
                                  </div>
                                  {c.actualDecisionNotes && (
                                    <div className="mt-1">
                                      <span className="font-semibold">Outcome notes: </span>
                                      {c.actualDecisionNotes}
                                    </div>
                                  )}
                                  {c.reviewerNotes && (
                                    <div className="mt-1">
                                      <span className="font-semibold">Reviewer notes: </span>
                                      {c.reviewerNotes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function SubgroupCard({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; total: number; concordant: number; concordancePct: number; ci95: { lo: number; hi: number } }>
}) {
  return (
    <div className="card">
      <h2 className="mb-3 text-sm font-semibold text-nhs-dark-blue">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-nhs-mid-grey">No cases yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
              <div className="flex justify-between">
                <span className="font-medium">{r.label}</span>
                <span className="font-semibold">{r.concordancePct}%</span>
              </div>
              <div className="text-[11px] text-nhs-mid-grey">
                {r.concordant}/{r.total} · 95% CI {Math.round(r.ci95.lo * 100)}–{Math.round(r.ci95.hi * 100)}%
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
