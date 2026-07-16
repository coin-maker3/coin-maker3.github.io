/**
 * GET /api/retrieve?ref=XXX — read back a patient submission for clinician import.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kvGet } from './_kv.js'
import { CAPTURE_ENABLED, CAPTURE_LOCKED_MESSAGE } from './_capture.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  // Master pilot lock: patient submissions can't be read back while capture is
  // disabled (there should be none stored anyway). See api/_capture.ts.
  if (!CAPTURE_ENABLED) return res.status(403).json({ error: CAPTURE_LOCKED_MESSAGE })
  try {
    const ref = String(req.query.ref ?? '')
    if (!ref) return res.status(400).json({ error: 'Missing ref' })
    const entry = await kvGet<{ payload: unknown; submittedAt: string }>(`submission:${ref}`)
    if (!entry) {
      return res.status(404).json({ error: 'No submission found for that reference' })
    }
    if (entry.payload == null || entry.submittedAt == null) {
      return res.status(500).json({ error: 'stored submission is malformed', ref })
    }
    res.status(200).json({
      ref,
      payload: entry.payload,
      submittedAt: entry.submittedAt,
    })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
