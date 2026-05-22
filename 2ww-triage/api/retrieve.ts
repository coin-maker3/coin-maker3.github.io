/**
 * GET /api/retrieve?ref=XXX — read back a patient submission for clinician import.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kvGet } from './_kv.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  try {
    const ref = String(req.query.ref ?? '')
    if (!ref) return res.status(400).json({ error: 'Missing ref' })
    const entry = await kvGet<{ payload: unknown; submittedAt: string }>(`submission:${ref}`)
    if (!entry) {
      return res.status(404).json({ error: 'No submission found for that reference' })
    }
    res.status(200).json({
      ref,
      payload: entry.payload ?? entry,
      submittedAt: entry.submittedAt ?? new Date().toISOString(),
    })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
