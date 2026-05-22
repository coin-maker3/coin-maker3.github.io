/**
 * POST /api/submit — store a patient pre-clinic submission against a reference.
 *
 * Storage: Vercel KV (Upstash Redis) when KV env vars are present;
 * otherwise an in-memory Map (Vercel dev only).
 *
 * TTL: 48 hours.
 *
 * No PID is accepted: reference must start with `TEST-` during pilot.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kvSet } from './_kv.js'

const TTL_SECONDS = 48 * 60 * 60

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const { ref, payload } = req.body ?? {}
    if (typeof ref !== 'string' || ref.length < 4 || ref.length > 64) {
      return res.status(400).json({ error: 'ref must be 4-64 chars' })
    }
    if (process.env.PILOT_REQUIRE_TEST_PREFIX === '1' && !ref.startsWith('TEST-')) {
      return res.status(400).json({ error: 'During testing, ref must start with TEST-' })
    }
    if (typeof payload !== 'object' || payload === null) {
      return res.status(400).json({ error: 'payload must be an object' })
    }
    await kvSet(`submission:${ref}`, payload, TTL_SECONDS)
    res.status(200).json({ ok: true, ref, expiresInHours: TTL_SECONDS / 3600 })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
