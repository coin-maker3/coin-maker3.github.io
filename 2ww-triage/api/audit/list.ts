import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kvScanPrefix } from '../_kv'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const cases = await kvScanPrefix('audit:')
    res.status(200).json({ cases })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
