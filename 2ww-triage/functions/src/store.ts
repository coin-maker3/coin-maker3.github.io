/**
 * Firestore-backed key/value store. Same surface as the Vercel build's
 * `api/_kv.ts` (Upstash Redis) so the endpoint handlers port unchanged.
 *
 * Key prefixes map to collections:
 *   submission:<ref>  -> submissions/<ref>   (patient pre-clinic, TTL 48h)
 *   audit:<id>        -> audit_cases/<id>     (audit cases, no TTL)
 *   cohort:current    -> audit_meta/current   (expected-cohort ID list)
 *
 * The whole database lives in europe-west2 (London) — UK soil. All access is
 * via the Admin SDK in the `api` function; Firestore rules deny clients.
 */
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

if (!getApps().length) initializeApp()
const db = getFirestore()

function locate(key: string): { coll: string; id: string } {
  const idx = key.indexOf(':')
  const prefix = idx === -1 ? key : key.slice(0, idx)
  const id = idx === -1 ? key : key.slice(idx + 1)
  switch (prefix) {
    case 'submission':
      return { coll: 'submissions', id }
    case 'audit':
      return { coll: 'audit_cases', id }
    case 'cohort':
      return { coll: 'audit_meta', id }
    default:
      return { coll: 'misc', id: id || prefix }
  }
}

/** Store with a TTL (used by patient submissions). Wraps value like the KV build. */
export async function kvSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const { coll, id } = locate(key)
  await db.collection(coll).doc(id).set({
    payload: value,
    submittedAt: new Date().toISOString(),
    expiresAt: Timestamp.fromMillis(Date.now() + ttlSeconds * 1000),
  })
}

/** Store with no expiry (used by audit cases + cohort). Value stored as-is. */
export async function kvSetForever(key: string, value: unknown): Promise<void> {
  const { coll, id } = locate(key)
  await db.collection(coll).doc(id).set(value as Record<string, unknown>)
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const { coll, id } = locate(key)
  const snap = await db.collection(coll).doc(id).get()
  if (!snap.exists) return null
  const data = snap.data() as Record<string, unknown> | undefined
  if (!data) return null
  // Lazy-expire TTL records on read, mirroring the in-memory KV semantics.
  const exp = data.expiresAt
  if (exp instanceof Timestamp && exp.toMillis() < Date.now()) {
    await snap.ref.delete().catch(() => {})
    return null
  }
  return data as T
}

export async function kvDel(key: string): Promise<void> {
  const { coll, id } = locate(key)
  await db.collection(coll).doc(id).delete()
}

/** Return every value whose key matches the prefix (only `audit:` is used). */
export async function kvScanPrefix<T>(prefix: string): Promise<T[]> {
  const { coll } = locate(prefix)
  const snap = await db.collection(coll).get()
  return snap.docs.map((d) => d.data() as T)
}
