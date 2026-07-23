# Executive Summary

## 2WW Colorectal Triage Aid — Quality Improvement Proposal

**George Eliot Hospital NHS Trust** · **Department of Colorectal Surgery**
**For:** Divisional Director / Clinical Director / CCIO
**Submitted by:** [Your name], [Your role]
**Date:** [Date]
**Decision sought:** Endorsement of departmental QI pilot and assignment of a Clinical Safety Officer + IG lead

---

### The problem

Every 2-week-wait colorectal clinic involves the same task for every
patient: read the GP referral, check Clinical Portal for bloods and prior
investigations, ask the patient a structured set of symptom questions,
fill the clinic form, then apply the Trust 2WW investigation algorithm
to choose between **colonoscopy / CT colonography / OGD / colon capsule /
flexible sigmoidoscopy / CT TAP / MDT / discharge** — each with its own
fitness criteria. This is mentally costly, time-consuming, and exposes
the patient to inter-clinician variation when the algorithm is misread or
misremembered under time pressure.

### The proposal

A locally-developed, browser-based decision-support tool that:

- Encodes the **current Trust 2WW colorectal investigation algorithm** as
  a versioned, deterministic decision tree, traceable node-by-node back
  to the MDT-approved PDF
- Asks the clinician for symptoms / bloods / fitness in the same order as
  the existing clinic form
- Produces a recommended investigation with full **rationale, alternatives
  and the algorithm path traversed**
- Stamps every decision with `algorithm.version`, `nodeId`,
  `clinicianId`, `timestamp` — i.e. a complete audit trail
- Generates a clinic letter draft that matches the Trust Word template
- Future-state (post-governance): patient pre-clinic questionnaire,
  EPR/Lab integration via FHIR, write-back of clinic letter to Trust EPR

### Benefits

| Benefit                                          | Estimate                                            |
|--------------------------------------------------|-----------------------------------------------------|
| Time saved per patient                           | 5–10 min (target)                                    |
| Inter-clinician variability                      | Eliminated for same input data                       |
| Algorithm-version provenance per decision        | Auditable indefinitely                               |
| Teaching value for trainees                      | Each branch is shown with reasoning + node ID        |
| Reduction in algorithm misapplications           | Currently unmeasured, baseline to be established in pilot |

### Status

- **Phase 0 pilot live** (single clinician, no PID, no Trust system access)
- Algorithm encoded with 42 unit tests + browser end-to-end smoke test
- Production target architecture documented (`DESIGN.md`) including
  NHS Login, FHIR integration, AWS UK hosting, hazard log
- Clinical Safety Officer not yet engaged — this proposal is to assign one

### Risk and mitigation

| Risk                                              | Mitigation                                                          |
|---------------------------------------------------|---------------------------------------------------------------------|
| Algorithm encoding diverges from Trust guidance   | MDT signs off algorithm version; CSO reviews diff each release      |
| Misuse as autonomous decision-maker               | Tool is decision **support**; override always available + logged    |
| Patient identifiable data leakage                 | Current pilot processes no PID; production will pseudonymise        |
| Skill atrophy in algorithm knowledge              | Tool **shows** the path traversed (teaching mode), doesn't hide it |
| Adoption / change-management resistance           | Voluntary, opt-in; pilot demonstrates value before mandating        |

### Resource ask

- Endorsement of departmental QI pilot
- **Named Clinical Safety Officer** to engage on DCB0129 (initial 30 min meeting)
- **Named Information Governance lead** to support DPIA when patient
  data processing begins
- Steering group: clinical lead (me), CSO, IG lead, MDT chair
- No financial ask in the current phase; future cloud hosting cost
  estimated at <£100/month for departmental scale (Phase 4 onwards)

### Decision sought

1. **Endorsement** to continue as a departmental QI project
2. **Named CSO and IG lead** assigned
3. **Quarterly review** by colorectal MDT to maintain algorithm version

### Out of scope

- Replacement of the colorectal MDT or COW process
- Any change to the Trust 2WW pathway itself (the tool encodes the
  existing pathway; pathway changes remain MDT/Trust-led)
- Autonomous decision-making or machine learning
- Data sharing outside the Trust

---

Full design document available on request (`DESIGN.md`, 16 sections).
Pilot accessible at **[pilot URL]** — no PID, no login required.
