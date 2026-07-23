/**
 * 2WW Colorectal audit API — single Cloud Function (Gen2, europe-west2).
 *
 * Firebase Hosting rewrites /api/** to this function. Routes mirror the old
 * Vercel serverless endpoints 1:1 so the React client is unchanged:
 *
 *   POST   /api/submit          patient pre-clinic submission   (LOCKED by default)
 *   GET    /api/retrieve        clinician import of a submission (LOCKED by default)
 *   POST   /api/audit/save      reviewer audit case — algorithm re-run server-side
 *   GET    /api/audit/list      all audit cases
 *   DELETE /api/audit/delete    delete an audit case
 *   GET/POST/DELETE /api/audit/cohort   expected-cohort ID list
 *
 * Storage is Firestore (europe-west2). The audit save re-runs the encoded
 * algorithm so the stored tool decision can't be tampered with by the client.
 */
import express, { type Request, type Response } from 'express'
import { onRequest } from 'firebase-functions/v2/https'

import { kvGet, kvSet, kvSetForever, kvDel, kvScanPrefix } from './store.js'
import { CAPTURE_ENABLED, CAPTURE_LOCKED_MESSAGE } from './capture.js'

import { decide } from '../../src/algorithm/engine'
import { ALGORITHM_VERSION } from '../../src/algorithm/version'
import { IntakeSchema, ageToBand } from '../../src/schema/intake'
import { INVESTIGATIONS } from '../../src/algorithm/types'
import { DISCORDANCE_REASONS, DISCORDANCE_DIRECTIONS } from '../../src/audit/types'

const TTL_SECONDS = 48 * 60 * 60
const MAX_PAYLOAD_BYTES = 50_000
const MAX_CASE_BYTES = 100_000
const MAX_COHORT_SIZE = 5000
const AUDIT_ID_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,39}$/

const app = express()
app.use(express.json({ limit: '200kb' }))

// ---- Patient pre-clinic submission (gated by the capture lock) ----------

app.post('/api/submit', async (req: Request, res: Response) => {
  if (!CAPTURE_ENABLED) return res.status(403).json({ error: CAPTURE_LOCKED_MESSAGE })
  try {
    const { ref, payload } = req.body ?? {}
    if (typeof ref !== 'string' || ref.length < 4 || ref.length > 64) {
      return res.status(400).json({ error: 'ref must be 4-64 chars' })
    }
    if (process.env.PILOT_REQUIRE_TEST_PREFIX === '1' && !ref.startsWith('TEST-')) {
      return res.status(400).json({ error: 'During testing, ref must start with TEST-' })
    }
    if (typeof payload !== 'object' || payload === null) {
      return res.status(400).json({ error: 'payload must be an object' })
    }
    const size = JSON.stringify(payload).length
    if (size > MAX_PAYLOAD_BYTES) {
      return res.status(413).json({ error: `payload too large (${size} bytes; max ${MAX_PAYLOAD_BYTES})` })
    }
    await kvSet(`submission:${ref}`, payload, TTL_SECONDS)
    res.status(200).json({ ok: true, ref, expiresInHours: TTL_SECONDS / 3600 })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
})

app.get('/api/retrieve', async (req: Request, res: Response) => {
  if (!CAPTURE_ENABLED) return res.status(403).json({ error: CAPTURE_LOCKED_MESSAGE })
  try {
    const ref = String(req.query.ref ?? '')
    if (!ref) return res.status(400).json({ error: 'Missing ref' })
    const entry = await kvGet<{ payload: unknown; submittedAt: string }>(`submission:${ref}`)
    if (!entry) {
      return res.status(404).json({ error: 'No submission found for that reference' })
    }
    if (entry.payload == null || entry.submittedAt == null) {
      return res.status(500).json({ error: 'stored submission is malformed', ref })
    }
    res.status(200).json({ ref, payload: entry.payload, submittedAt: entry.submittedAt })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
})

// ---- Reviewer concordance audit (the deliverable — always live) ----------

app.post('/api/audit/save', async (req: Request, res: Response) => {
  try {
    const data = req.body
    if (!data?.id || typeof data.id !== 'string') {
      return res.status(400).json({ error: 'Missing id' })
    }
    if (!AUDIT_ID_PATTERN.test(data.id)) {
      return res.status(400).json({
        error: 'id must be 3–40 chars, start with letter/digit, uppercase + digits + dash/underscore only',
      })
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

    const parsedIntake = IntakeSchema.safeParse(data.intake)
    if (!parsedIntake.success) {
      return res.status(400).json({ error: 'invalid intake', issues: parsedIntake.error.issues.slice(0, 5) })
    }

    const isExcluded = data.excluded === true
    const VALID_EXCLUSION_REASONS = [
      'dna',
      'discharged_before_assessment',
      'direct_to_mdt',
      'withdrew_consent',
      'duplicate_referral',
      'other',
    ]
    if (isExcluded) {
      if (!data.exclusionReason || !VALID_EXCLUSION_REASONS.includes(data.exclusionReason)) {
        return res.status(400).json({ error: 'excluded=true requires a valid exclusionReason' })
      }
    } else {
      if (!INVESTIGATIONS.includes(data.actualDecision)) {
        return res.status(400).json({ error: 'invalid actualDecision' })
      }
    }

    // Age is the source of truth — re-derive ageBand server-side so a tampered
    // client can't trick the engine into the wrong branch.
    const intake =
      parsedIntake.data.age != null
        ? { ...parsedIntake.data, ageBand: ageToBand(parsedIntake.data.age) }
        : parsedIntake.data

    // Server re-runs the engine; client-sent toolDecision is ignored. This is
    // what makes the audit dataset tamper-evident.
    const serverDecision = decide(intake)
    const serverConcordant = !isExcluded && serverDecision.investigation === data.actualDecision

    // A real mismatch must be classified — reason + direction. Validated against
    // the SERVER's concordance verdict so the classification can't be faked.
    if (!isExcluded && !serverConcordant) {
      if (!DISCORDANCE_REASONS.includes(data.discordanceReason)) {
        return res.status(400).json({ error: 'mismatch requires a valid discordanceReason' })
      }
      if (!DISCORDANCE_DIRECTIONS.includes(data.discordanceDirection)) {
        return res.status(400).json({ error: 'mismatch requires a valid discordanceDirection' })
      }
    }

    const authoritative = {
      id: data.id,
      enteredBy: typeof data.enteredBy === 'string' ? data.enteredBy.toUpperCase().slice(0, 4) : '',
      clinicMonth: typeof data.clinicMonth === 'string' ? data.clinicMonth : '',
      intake,
      toolDecision: {
        investigation: serverDecision.investigation,
        nodeId: serverDecision.algorithmNodeId,
        algorithmVersion: ALGORITHM_VERSION.version,
        rationale: serverDecision.rationale,
        path: serverDecision.path,
        warnings: serverDecision.warnings,
      },
      actualDecision: isExcluded ? null : data.actualDecision,
      actualDecisionNotes: typeof data.actualDecisionNotes === 'string' ? data.actualDecisionNotes : '',
      reviewerNotes: typeof data.reviewerNotes === 'string' ? data.reviewerNotes : '',
      excluded: isExcluded || undefined,
      exclusionReason: isExcluded ? data.exclusionReason : undefined,
      exclusionNotes:
        isExcluded && typeof data.exclusionNotes === 'string' ? data.exclusionNotes.slice(0, 500) : undefined,
      concordant: serverConcordant,
      discordanceReason: !isExcluded && !serverConcordant ? data.discordanceReason : undefined,
      discordanceDirection: !isExcluded && !serverConcordant ? data.discordanceDirection : undefined,
      createdAt: new Date().toISOString(),
      timeTakenSeconds: typeof data.timeTakenSeconds === 'number' ? data.timeTakenSeconds : null,
    }

    const existing = await kvGet(`audit:${data.id}`)
    if (existing != null) {
      return res.status(409).json({ error: 'id_exists', id: data.id })
    }
    // Firestore rejects `undefined` field values — strip them before write.
    const clean = JSON.parse(JSON.stringify(authoritative))
    await kvSetForever(`audit:${data.id}`, clean)
    res.status(200).json({ ok: true, id: data.id, concordant: authoritative.concordant })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
})

app.get('/api/audit/list', async (_req: Request, res: Response) => {
  try {
    const cases = await kvScanPrefix('audit:')
    res.status(200).json({ cases })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
})

app.delete('/api/audit/delete', async (req: Request, res: Response) => {
  try {
    const id = String(req.query.id ?? '')
    if (!id) return res.status(400).json({ error: 'Missing id' })
    await kvDel(`audit:${id}`)
    res.status(200).json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
})

// ---- Expected-cohort ID list (anonymised audit IDs only) -----------------

interface CohortRecord {
  ids: string[]
  updatedAt: string
  updatedBy: string
  notes?: string
}

app.all('/api/audit/cohort', async (req: Request, res: Response) => {
  try {
    if (req.method === 'GET') {
      const c = (await kvGet<CohortRecord>('cohort:current')) ?? { ids: [], updatedAt: '', updatedBy: '' }
      return res.status(200).json(c)
    }
    if (req.method === 'POST') {
      const body = req.body ?? {}
      const ids: unknown = body.ids
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: 'ids must be an array' })
      }
      if (ids.length > MAX_COHORT_SIZE) {
        return res.status(413).json({ error: `cohort too large (max ${MAX_COHORT_SIZE})` })
      }
      const normalised: string[] = []
      for (const raw of ids) {
        if (typeof raw !== 'string') continue
        const id = raw.trim().toUpperCase()
        if (!id) continue
        if (!AUDIT_ID_PATTERN.test(id)) {
          return res
            .status(400)
            .json({ error: `invalid id "${raw}" — must be 3–40 chars, alphanumeric + dash/underscore` })
        }
        normalised.push(id)
      }
      const seen = new Set<string>()
      const dedup: string[] = []
      for (const id of normalised) {
        if (seen.has(id)) continue
        seen.add(id)
        dedup.push(id)
      }
      const updatedBy = typeof body.updatedBy === 'string' ? body.updatedBy.toUpperCase().slice(0, 8) : ''
      const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : ''
      const record: CohortRecord = { ids: dedup, updatedAt: new Date().toISOString(), updatedBy, notes }
      await kvSetForever('cohort:current', record as unknown as Record<string, unknown>)
      return res.status(200).json({ ok: true, count: dedup.length, updatedAt: record.updatedAt })
    }
    if (req.method === 'DELETE') {
      await kvDel('cohort:current')
      return res.status(200).json({ ok: true })
    }
    return res.status(405).json({ error: 'GET / POST / DELETE only' })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'internal error' })
  }
})

app.use((_req: Request, res: Response) => res.status(404).json({ error: 'not found' }))

export const api = onRequest({ region: 'europe-west2', memory: '256MiB', maxInstances: 10 }, app)
