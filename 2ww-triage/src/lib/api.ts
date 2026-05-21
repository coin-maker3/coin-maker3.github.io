/**
 * Client for the (very small) submission API.
 *
 * Local dev: the Vite dev server hosts /api/* via vite-api-plugin.ts
 * Production: same /api/* but deployed as serverless functions (Vercel/Cloudflare)
 *
 * No PID is sent — only the reference number and patient-supplied symptom answers.
 */
const API_BASE = ''

export interface SubmitResponse {
  ok: boolean
  ref: string
  expiresInHours: number
}

export interface RetrieveResponse {
  ref: string
  payload: Record<string, unknown>
  submittedAt: string
}

export async function submitPatientForm(
  ref: string,
  payload: Record<string, unknown>,
): Promise<SubmitResponse> {
  const res = await fetch(`${API_BASE}/api/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ref, payload }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Submit failed (HTTP ${res.status})`)
  }
  return res.json()
}

export async function retrievePatientForm(ref: string): Promise<RetrieveResponse> {
  const res = await fetch(
    `${API_BASE}/api/retrieve?ref=${encodeURIComponent(ref)}`,
  )
  if (res.status === 404) {
    throw new Error(`No submission found for reference "${ref}". The patient may not have filled the form yet, or the reference has expired.`)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Lookup failed (HTTP ${res.status})`)
  }
  return res.json()
}

export function generateTestRef(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const part = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `TEST-${part(4)}-${part(4)}`
}
