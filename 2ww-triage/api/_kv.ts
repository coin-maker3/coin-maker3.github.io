/**
 * Tiny KV abstraction. Uses Vercel KV (Upstash Redis) in production via the
 * @vercel/kv SDK when KV_* env vars are configured. Falls back to an
 * in-memory Map for local dev so the same code works either side.
 */

interface MemEntry {
  value: unknown
  expiresAt: number
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

export async function kvGet<T>(key: string): Promise<T | null> {
  if (inVercelKv()) {
    const { kv } = await import('@vercel/kv')
    return (await kv.get<T>(key)) ?? null
  }
  const entry = mem.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    mem.delete(key)
    return null
  }
  return entry.value as T
}
