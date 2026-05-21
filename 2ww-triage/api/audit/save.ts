import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kvSetForever } from '../_kv'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const data = req.body
    if (!data?.id || typeof data.id !== 'string') {
      return res.status(400).json({ error: 'Missing id' })
    }
    await kvSetForever(`audit:${data.id}`, data)
    res.status(200).json({ ok: true, id: data.id })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
