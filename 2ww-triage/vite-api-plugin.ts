/**
 * Vite dev-server middleware that emulates the production API.
 *
 * In production these are deployed as serverless functions (see `/api/*.ts`).
 * In development the same in-memory storage is exposed here so the app works
 * end-to-end with a single `vite dev` command.
 *
 * Storage is in-process and dies with the server. 48-hour TTL per record.
 */
import type { ViteDevServer } from 'vite'

const store = new Map<string, { payload: unknown; expiresAt: number; createdAt: number }>()
const auditStore = new Map<string, any>() // audit cases — no TTL
const TTL_MS = 48 * 60 * 60 * 1000

const json = (res: any, status: number, body: unknown) => {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const readBody = (req: any): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => (body += chunk.toString()))
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })

const sweep = () => {
  const now = Date.now()
  for (const [k, v] of store.entries()) {
    if (v.expiresAt < now) store.delete(k)
  }
}

export function apiMiddleware() {
  return {
    name: 'twoww-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/submit', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next()
        try {
          sweep()
          const raw = await readBody(req)
          const { ref, payload } = JSON.parse(raw)
          if (typeof ref !== 'string' || ref.length < 4 || ref.length > 64) {
            return json(res, 400, { error: 'ref must be 4-64 chars' })
          }
          if (typeof payload !== 'object' || payload === null) {
            return json(res, 400, { error: 'payload must be an object' })
          }
          const now = Date.now()
          store.set(ref, { payload, expiresAt: now + TTL_MS, createdAt: now })
          json(res, 200, { ok: true, ref, expiresInHours: 48 })
        } catch (e: any) {
          json(res, 400, { error: e.message ?? 'bad request' })
        }
      })

      server.middlewares.use('/api/retrieve', async (req: any, res: any, next: any) => {
        if (req.method !== 'GET') return next()
        try {
          sweep()
          const url = new URL(req.url, 'http://x')
          const ref = url.searchParams.get('ref')
          if (!ref) return json(res, 400, { error: 'Missing ref' })
          const entry = store.get(ref)
          if (!entry) return json(res, 404, { error: 'No submission found for that reference' })
          json(res, 200, {
            ref,
            payload: entry.payload,
            submittedAt: new Date(entry.createdAt).toISOString(),
          })
        } catch (e: any) {
          json(res, 500, { error: e.message ?? 'internal error' })
        }
      })

      server.middlewares.use('/api/_debug', (_req: any, res: any) => {
        sweep()
        json(res, 200, {
          count: store.size,
          refs: Array.from(store.keys()),
        })
      })

      // ===== Audit endpoints =====
      // Audit cases are kept indefinitely (no TTL) — they're an audit dataset.

      server.middlewares.use('/api/audit/save', async (req: any, res: any, next: any) => {
        if (req.method !== 'POST') return next()
        try {
          const raw = await readBody(req)
          const data = JSON.parse(raw)
          if (!data.id || typeof data.id !== 'string') {
            return json(res, 400, { error: 'Missing id' })
          }
          auditStore.set(data.id, data)
          json(res, 200, { ok: true, id: data.id })
        } catch (e: any) {
          json(res, 400, { error: e.message ?? 'bad request' })
        }
      })

      server.middlewares.use('/api/audit/list', (_req: any, res: any) => {
        json(res, 200, { cases: Array.from(auditStore.values()) })
      })

      server.middlewares.use('/api/audit/delete', (req: any, res: any) => {
        const url = new URL(req.url, 'http://x')
        const id = url.searchParams.get('id')
        if (!id) return json(res, 400, { error: 'Missing id' })
        const existed = auditStore.delete(id)
        json(res, existed ? 200 : 404, { ok: existed })
      })
    },
  }
}
