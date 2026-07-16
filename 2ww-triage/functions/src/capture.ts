/**
 * Patient pre-clinic capture lock (Cloud Functions side). Mirror of
 * `2ww-triage/api/_capture.ts` from the Vercel build.
 *
 * Default = LOCKED. Gates the PATIENT pre-clinic pathway only (submit +
 * retrieve) — the "referral upload" the consultant asked to disable so no
 * identifiable patient data can be submitted before audit governance is in
 * place. The reviewer concordance audit (audit/save) is NOT gated.
 *
 * To re-enable the patient pathway later (Phase 2): set CAPTURE_ENABLED=1 in
 * the function's environment and redeploy.
 */
export const CAPTURE_ENABLED = process.env.CAPTURE_ENABLED === '1'

export const CAPTURE_LOCKED_MESSAGE =
  'Patient pre-clinic submission is disabled pending audit governance. No patient data is stored.'
