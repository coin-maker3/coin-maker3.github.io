import type { VercelRequest, VercelResponse } from '@vercel/node'
import { kvGet, kvSetForever } from '../_kv.js'
import { decide } from '../../src/algorithm/engine.js'
import { ALGORITHM_VERSION } from '../../src/algorithm/version.js'
import { IntakeSchema } from '../../src/schema/intake.js'
import { INVESTIGATIONS } from '../../src/algorithm/types.js'

const MAX_CASE_BYTES = 100_000 // 100 KB — generous for a fully-populated audit case
const AUDIT_ID_PATTERN = /^AUDIT-\d{4}-\d{4,6}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const data = req.body
    if (!data?.id || typeof data.id !== 'string') {
      return res.status(400).json({ error: 'Missing id' })
    }
    if (!AUDIT_ID_PATTERN.test(data.id)) {
      return res.status(400).json({ error: 'id must match AUDIT-YYYY-NNNN' })
    }
    if (process.env.PILOT_REQUIRE_TEST_PREFIX === '1') {
      const initials = typeof data.enteredBy === 'string' ? data.enteredBy : ''
      if (!initials || initials.length > 4) {
        return res.status(400).json({ error: 'enteredBy must be 1-4 char initials' })
      }
    }
    const size = JSON.stringify(data).length
    if (size > MAX_CASE_BYTES) {
      return res.status(413).json({ error: `case too large (${size} bytes; max ${MAX_CASE_BYTES})` })
    }

    // Validate intake server-side so the audit dataset only contains
    // structurally-valid clinical findings.
    const parsedIntake = IntakeSchema.safeParse(data.intake)
    if (!parsedIntake.success) {
      return res.status(400).json({
        error: 'invalid intake',
        issues: parsedIntake.error.issues.slice(0, 5),
      })
    }

    // Validate actualDecision is a known investigation.
    if (!INVESTIGATIONS.includes(data.actualDecision)) {
      return res.status(400).json({ error: 'invalid actualDecision' })
    }

    // Server is the source of truth for the tool's recommendation.
    // Re-run the engine, stamp algorithm version + full path. The client-
    // sent toolDecision is ignored — this makes the audit dataset
    // tamper-evident.
    const serverDecision = decide(parsedIntake.data)
    const authoritative = {
      id: data.id,
      enteredBy: typeof data.enteredBy === 'string' ? data.enteredBy.toUpperCase().slice(0, 4) : '',
      clinicMonth: typeof data.clinicMonth === 'string' ? data.clinicMonth : '',
      intake: parsedIntake.data,
      toolDecision: {
        investigation: serverDecision.investigation,
        nodeId: serverDecision.algorithmNodeId,
        algorithmVersion: ALGORITHM_VERSION.version,
        rationale: serverDecision.rationale,
        path: serverDecision.path,
        warnings: serverDecision.warnings,
      },
      actualDecision: data.actualDecision,
      actualDecisionNotes: typeof data.actualDecisionNotes === 'string' ? data.actualDecisionNotes : '',
      reviewerNotes: typeof data.reviewerNotes === 'string' ? data.reviewerNotes : '',
      concordant: serverDecision.investigation === data.actualDecision,
      createdAt: new Date().toISOString(),
      timeTakenSeconds: typeof data.timeTakenSeconds === 'number' ? data.timeTakenSeconds : null,
    }

    const existing = await kvGet(`audit:${data.id}`)
    if (existing != null) {
      return res.status(409).json({ error: 'id_exists', id: data.id })
    }
    await kvSetForever(`audit:${data.id}`, authoritative)
    res.status(200).json({ ok: true, id: data.id, concordant: authoritative.concordant })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
