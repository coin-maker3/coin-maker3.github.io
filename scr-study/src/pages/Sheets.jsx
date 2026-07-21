import { Link } from 'react-router-dom'
import { sheets } from '../lib/content.js'

export default function Sheets() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Knowledge sheets</h1>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
        {sheets.map((s, i) => (
          <Link
            key={s.id}
            to={`/sheets/${s.id}`}
            className={`flex items-center justify-between gap-3 p-4 active:bg-slate-50 ${
              i > 0 ? 'border-t border-slate-100' : ''
            }`}
          >
            <p className="font-medium">{s.title}</p>
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
        ))}
        {sheets.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-400">No sheets yet.</p>
        )}
      </div>
    </div>
  )
}
