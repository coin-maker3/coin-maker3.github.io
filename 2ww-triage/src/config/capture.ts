/// <reference types="vite/client" />
/**
 * Patient pre-clinic capture lock for the 2WW Colorectal pilot (client side).
 *
 * Default = LOCKED. Mirrors the server guard in `api/_capture.ts`. When locked,
 * the UI hides the patient "upload / import / issue form" affordances. It does
 * NOT affect the reviewer concordance audit (/audit/new), which stays live —
 * that's the deliverable.
 *
 * The server enforces the same lock independently, so this flag only governs
 * whether the user is shown a button that would otherwise fail.
 *
 * To re-enable the patient pathway later (Phase 2): set VITE_CAPTURE_ENABLED=1
 * in the Vercel project environment (Production) and redeploy.
 */
export const CAPTURE_ENABLED = import.meta.env.VITE_CAPTURE_ENABLED === '1'
