import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kvGet, kvSetForever } from '../_kv.js'

const MAX_CASE_BYTES = 100_000 // 100 KB — generous for a fully-populated audit case
const AUDIT_ID_PATTERN = /^AUDIT-\d{4}-\d{4,6}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const data = req.body
    if (!data?.id || typeof data.id !== 'string') {
      return res.status(400).json({ error: 'Missing id' })
    }
    if (!AUDIT_ID_PATTERN.test(data.id)) {
      return res.status(400).json({ error: 'id must match AUDIT-YYYY-NNNN' })
    }
    if (process.env.PILOT_REQUIRE_TEST_PREFIX === '1') {
      const initials = typeof data.enteredBy === 'string' ? data.enteredBy : ''
      if (!initials || initials.length > 4) {
        return res.status(400).json({ error: 'enteredBy must be 1-4 char initials' })
      }
    }
    const size = JSON.stringify(data).length
    if (size > MAX_CASE_BYTES) {
      return res.status(413).json({ error: `case too large (${size} bytes; max ${MAX_CASE_BYTES})` })
    }
    const existing = await kvGet(`audit:${data.id}`)
    if (existing != null) {
      return res.status(409).json({ error: 'id_exists', id: data.id })
    }
    await kvSetForever(`audit:${data.id}`, data)
    res.status(200).json({ ok: true, id: data.id })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
