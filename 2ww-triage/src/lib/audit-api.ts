import type { AuditCase } from '../audit/types'

const API = ''

export async function saveAuditCase(c: AuditCase): Promise<void> {
  const res = await fetch(`${API}/api/audit/save`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(c),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Save failed (HTTP ${res.status})`)
  }
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
  // Find highest existing sequence
  let maxSeq = 0
  for (const id of existingIds) {
    const m = id.match(/AUDIT-\d+-(\d+)/)
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10))
  }
  const next = Math.max(maxSeq + 1, counter + 1)
  counter = next
  return `AUDIT-${year}-${String(next).padStart(4, '0')}`
}
