import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kvGet, kvSetForever } from '../_kv.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const data = req.body
    if (!data?.id || typeof data.id !== 'string') {
      return res.status(400).json({ error: 'Missing id' })
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
