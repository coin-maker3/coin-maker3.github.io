# Email to Clinical Safety Officer

> Save as: `docs/letters/01-cso-introduction.md`
> Send to: Trust CSO (cc: divisional director, colorectal MDT lead)
> Customise the **[bracketed]** sections before sending.

---

**Subject:** 2WW Colorectal Triage Aid — request for DCB0129 / DCB0160 engagement

Dear **[CSO name]**,

I'm writing to introduce a clinical decision support project I've been
developing locally and to ask for your input on the clinical safety pathway
before we take it any further.

## What it is

A web-based triage aid for the 2-week-wait colorectal clinic. It encodes
our existing Trust 2WW colorectal investigation algorithm
(`LATEST_2WW_INVESTIGATIONS__ALGORITHM_4.pdf`, current MDT-approved
version) as a deterministic decision tree. The clinician enters the
patient's symptoms, bloods, FIT and fitness, and the tool surfaces the
recommended investigation with full traceability back to a node in the
PDF.

It is **decision support**, not autonomous decision-making — the
clinician retains full authority to confirm or override (overrides are
audit-logged with reason).

## Why I built it

In every 2WW clinic I spend a non-trivial chunk of mental effort
re-deriving the algorithm branch for each patient. Junior colleagues
tell me the same. A versioned encoding of the algorithm:

- Cuts triage time per patient
- Removes inter-clinician variability for the same data
- Produces an auditable record of *which version* of the Trust algorithm
  was applied to which patient
- Doubles as a teaching tool for trainees

## Current state

A local pilot is live at **[pilot URL]** with no patient identifiable
data. The full Trust algorithm is encoded with **42 unit tests** and a
browser end-to-end smoke test, all passing. The decision engine stamps
every output with the algorithm ID, version, node ID, traversed path and
ISO timestamp — i.e. the exact data a CSO would want to see for any
adverse-event review.

## What I'd like from you

I have written a target architecture document (attached: `DESIGN.md`)
describing what a governance-cleared production version would look like
(NHS Login, FHIR integration with bloods/EPR, AWS UK hosting, full audit
trail, pseudonymisation).

Before going further, I'd value **30 minutes of your time** to discuss:

1. The DCB0129 (supplier-side) clinical safety case pathway — what you
   need from the project to produce one
2. Whether the current pilot, with no PID and no Trust integration,
   needs DCB0160 sign-off in its present form, or whether that only
   applies once Trust systems are involved
3. The hazard log I've drafted (Section 10.1 of `DESIGN.md`) — is the
   structure usable as a starting point?
4. Who in the Trust takes the deployment-side (DCB0160) safety role,
   and how I engage them at the right stage

I'd also welcome your view on whether this should be progressed as:

- A **personal productivity tool** (Phase 0–1 in `DESIGN.md`)
- A **departmental quality-improvement project** (Phase 2)
- A **Trust-sponsored digital initiative** (Phase 3+)

The shape of the governance pathway differs significantly between these.

## What this is not

To be explicit:

- It is **not** a medical device in the autonomous-decision sense — every
  recommendation is reviewable, override-able and audit-traceable.
- It is **not** intended to replace clinical judgement, the colorectal
  MDT, or the COW.
- It is **not** processing any patient identifiable data in its current
  form (no name, DOB, NHS number, free-text identifiers).

I would rather have the safety conversation early and shape the project
around it, than build further and have to retrofit. I'm conscious that
"clinician-built decision support" has a chequered history without CSO
engagement, and I'd like to do this properly.

Could we find 30 minutes in the next two weeks?

Kind regards,

**[Your name]**
**[Your role]**, Department of Colorectal Surgery
George Eliot Hospital NHS Trust
**[Email]**

---

### Attachment checklist (send with the email)

- [ ] `DESIGN.md` — target architecture document
- [ ] Algorithm PDF (`LATEST_2WW_INVESTIGATIONS__ALGORITHM_4.pdf`) — for context
- [ ] Pilot URL (if available behind Trust auth, otherwise screenshot)
- [ ] One-page exec summary (`02-executive-summary.md`)
