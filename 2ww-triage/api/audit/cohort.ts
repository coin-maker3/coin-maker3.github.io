/**
 * /api/audit/cohort
 *   GET    → return the current expected-cohort ID list (audit-lead view).
 *   POST   → replace the cohort list with the supplied IDs.
 *   DELETE → clear the cohort.
 *
 * Stored in Vercel KV under the single key `audit:cohort`. The cohort
 * list contains anonymised audit IDs only (e.g. GEH-2WW-001) — never PID.
 * The audit lead's linkage table (audit ID ↔ patient name + NHS no + DOB)
 * lives OFFLINE on a Trust device and never enters this tool.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kvDel, kvGet, kvSetForever } from '../_kv.js'

const MAX_COHORT_SIZE = 5000
// Same shape as the audit ID — anything we store here we accept on save.
const AUDIT_ID_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,39}$/

interface CohortRecord {
  ids: string[]
  updatedAt: string
  updatedBy: string // initials of the audit lead who set it
  notes?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const c = (await kvGet<CohortRecord>('cohort:current')) ?? {
        ids: [],
        updatedAt: '',
        updatedBy: '',
      }
      return res.status(200).json(c)
    }
    if (req.method === 'POST') {
      const body = req.body ?? {}
      const ids: unknown = body.ids
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: 'ids must be an array' })
      }
      if (ids.length > MAX_COHORT_SIZE) {
        return res.status(413).json({ error: `cohort too large (max ${MAX_COHORT_SIZE})` })
      }
      const normalised: string[] = []
      for (const raw of ids) {
        if (typeof raw !== 'string') continue
        const id = raw.trim().toUpperCase()
        if (!id) continue
        if (!AUDIT_ID_PATTERN.test(id)) {
          return res.status(400).json({ error: `invalid id "${raw}" — must be 3–40 chars, alphanumeric + dash/underscore` })
        }
        normalised.push(id)
      }
      // Deduplicate while preserving first-seen order.
      const seen = new Set<string>()
      const dedup: string[] = []
      for (const id of normalised) {
        if (seen.has(id)) continue
        seen.add(id)
        dedup.push(id)
      }
      const updatedBy = typeof body.updatedBy === 'string' ? body.updatedBy.toUpperCase().slice(0, 8) : ''
      const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : ''
      const record: CohortRecord = {
        ids: dedup,
        updatedAt: new Date().toISOString(),
        updatedBy,
        notes,
      }
      await kvSetForever('cohort:current', record)
      return res.status(200).json({ ok: true, count: dedup.length, updatedAt: record.updatedAt })
    }
    if (req.method === 'DELETE') {
      await kvDel('cohort:current')
      return res.status(200).json({ ok: true })
    }
    return res.status(405).json({ error: 'GET / POST / DELETE only' })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
