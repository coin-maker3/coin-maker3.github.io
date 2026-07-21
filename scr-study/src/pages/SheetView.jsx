import { Link, useParams } from 'react-router-dom'
import { getSheet } from '../lib/content.js'
import Markdown from '../components/Markdown.jsx'

export default function SheetView() {
  const { id } = useParams()
  const sheet = getSheet(id)

  if (!sheet) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">Sheet not found.</p>
        <Link to="/sheets" className="mt-2 inline-block font-medium text-teal-700">
          Back to sheets
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/sheets" className="text-sm font-medium text-teal-700">
          ← Sheets
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight">{sheet.title}</h1>
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <Markdown>{sheet.body}</Markdown>
      </div>
    </div>
  )
}
