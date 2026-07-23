/**
 * Patient pre-clinic capture lock for the 2WW Colorectal pilot (server side).
 *
 * Default = LOCKED. This gates the PATIENT pre-clinic pathway only — the
 * "referral upload" the consultant asked to disable so no identifiable patient
 * data can be submitted by mistake before audit governance is in place:
 *   - POST /api/submit   (patient submits their pre-clinic answers)
 *   - GET  /api/retrieve (clinician imports a patient submission)
 *
 * It does NOT gate the reviewer concordance audit (/api/audit/save). The audit
 * is the deliverable: reviewers transcribe an anonymised case (no NHS number,
 * name or DOB) and compare the tool's recommendation against the actual clinic
 * letter. That pathway stays live.
 *
 * The algorithm / decision support runs entirely client-side and stores
 * nothing, so the calculator is always fully usable.
 *
 * This is the authoritative guard: hiding the buttons in the UI is not enough,
 * because a hand-crafted POST would bypass the UI.
 *
 * To re-enable the patient pathway later (Phase 2): set CAPTURE_ENABLED=1 in
 * the Vercel project environment (Production) and redeploy.
 */
export const CAPTURE_ENABLED = process.env.CAPTURE_ENABLED === '1'

export const CAPTURE_LOCKED_MESSAGE =
  'Patient pre-clinic submission is disabled pending audit governance. No patient data is stored.'
