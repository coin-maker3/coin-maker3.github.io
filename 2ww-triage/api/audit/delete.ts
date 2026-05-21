import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kvDel } from '../_kv'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'DELETE only' })
  try {
    const id = String(req.query.id ?? '')
    if (!id) return res.status(400).json({ error: 'Missing id' })
    await kvDel(`audit:${id}`)
    res.status(200).json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
