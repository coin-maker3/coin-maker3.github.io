import type { AuditCase } from '../audit/types'

const API = ''
const ID_CONFLICT_RETRIES = 5

export class IdConflictError extends Error {
  readonly id: string
  constructor(id: string) {
    super(`Audit ID ${id} already exists`)
    this.name = 'IdConflictError'
    this.id = id
  }
}

async function postSave(c: AuditCase): Promise<Response> {
  return fetch(`${API}/api/audit/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(c),
  })
}

export async function saveAuditCase(c: AuditCase): Promise<{ id: string }> {
  const res = await postSave(c)
  if (res.status === 409) throw new IdConflictError(c.id)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Save failed (HTTP ${res.status})`)
  }
  return { id: c.id }
}

/**
 * Save with automatic ID-conflict resilience. If two FY1s race and both
 * generate the same AUDIT-YYYY-NNNN, the second save returns 409 and we
 * re-fetch the list, regenerate the next ID, and retry (up to N times).
 */
export async function saveAuditCaseSafe(
  c: AuditCase,
  bumpId: (existingIds: string[]) => string,
): Promise<{ id: string }> {
  let caseToSave = c
  for (let attempt = 0; attempt < ID_CONFLICT_RETRIES; attempt++) {
    try {
      return await saveAuditCase(caseToSave)
    } catch (e) {
      if (!(e instanceof IdConflictError)) throw e
      const existing = await listAuditCases().then((l) => l.map((c) => c.id)).catch(() => [])
      caseToSave = { ...caseToSave, id: bumpId(existing) }
    }
  }
  throw new Error(`Could not allocate a unique audit ID after ${ID_CONFLICT_RETRIES} attempts`)
}

export async function listAuditCases(): Promise<AuditCase[]> {
  const res = await fetch(`${API}/api/audit/list`)
  if (!res.ok) throw new Error(`List failed (HTTP ${res.status})`)
  const data = await res.json()
  return data.cases as AuditCase[]
}

export async function deleteAuditCase(id: string): Promise<void> {
  const res = await fetch(`${API}/api/audit/delete?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`)
}

let counter = 0
export function generateAuditId(existingIds: string[]): string {
  const year = new Date().getFullYear()
  let maxSeq = 0
  for (const id of existingIds) {
    const m = id.match(/AUDIT-\d+-(\d+)/)
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10))
  }
  const next = Math.max(maxSeq + 1, counter + 1)
  counter = next
  return `AUDIT-${year}-${String(next).padStart(4, '0')}`
}
