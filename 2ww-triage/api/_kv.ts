/**
 * Tiny KV abstraction backing both the patient-submission TTL store and the
 * (no-TTL) audit case store. Uses Vercel KV (Upstash Redis) in production and
 * an in-process Map for local dev (Vercel CLI's `vercel dev`).
 */

interface MemEntry {
  value: unknown
  expiresAt: number | null
}

const mem = new Map<string, MemEntry>()

const inVercelKv = () =>
  !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

export async function kvSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (inVercelKv()) {
    const { kv } = await import('@vercel/kv')
    await kv.set(
      key,
      { payload: value, submittedAt: new Date().toISOString() },
      { ex: ttlSeconds },
    )
    return
  }
  mem.set(key, {
    value: { payload: value, submittedAt: new Date().toISOString() },
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

export async function kvSetForever(key: string, value: unknown): Promise<void> {
  if (inVercelKv()) {
    const { kv } = await import('@vercel/kv')
    await kv.set(key, value)
    return
  }
  mem.set(key, { value, expiresAt: null })
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (inVercelKv()) {
    const { kv } = await import('@vercel/kv')
    return (await kv.get<T>(key)) ?? null
  }
  const entry = mem.get(key)
  if (!entry) return null
  if (entry.expiresAt != null && entry.expiresAt < Date.now()) {
    mem.delete(key)
    return null
  }
  return entry.value as T
}

export async function kvDel(key: string): Promise<void> {
  if (inVercelKv()) {
    const { kv } = await import('@vercel/kv')
    await kv.del(key)
    return
  }
  mem.delete(key)
}

export async function kvScanPrefix<T>(prefix: string): Promise<T[]> {
  if (inVercelKv()) {
    const { kv } = await import('@vercel/kv')
    const keys: string[] = []
    let cursor = 0
    do {
      const [next, batch] = await kv.scan(cursor, { match: `${prefix}*`, count: 100 })
      cursor = typeof next === 'string' ? parseInt(next, 10) : next
      keys.push(...batch)
    } while (cursor !== 0)
    if (keys.length === 0) return []
    const values = await Promise.all(keys.map((k) => kv.get<T>(k)))
    return values.filter((v): v is Awaited<T> => v != null) as T[]
  }
  const out: T[] = []
  for (const [k, v] of mem.entries()) {
    if (!k.startsWith(prefix)) continue
    if (v.expiresAt != null && v.expiresAt < Date.now()) continue
    out.push(v.value as T)
  }
  return out
}
