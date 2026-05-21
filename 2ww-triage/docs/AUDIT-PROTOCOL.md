# 2WW Colorectal Triage Aid — Concordance Audit Protocol

> **Status:** draft for Trust Audit & Quality Improvement office registration
> **Submitting clinician lead:** [Your name], colorectal surgery
> **Senior endorsement:** Mr Kasun, [role]
> **Date:** [Date]

## 1. Title

**Agreement between an algorithm-based decision support tool and consultant
clinical decision in the 2WW colorectal pathway: a retrospective
single-centre audit at George Eliot Hospital.**

## 2. Background and rationale

The Trust 2WW colorectal investigation algorithm guides the choice of
initial investigation (colonoscopy / CTC / colon capsule / etc.) for
suspected colorectal cancer referrals. We have encoded this algorithm
into a decision-support tool (`GEH-2WW-COLORECTAL v0.2.1`) that, given
the patient's symptoms, bloods, FIT, and fitness, returns a recommended
investigation with full traceability to the algorithm PDF.

Before any clinical adoption, we need to know **how well the tool's
recommendation agrees with what the colorectal team actually decided in
clinic**. This audit establishes that baseline and identifies systematic
disagreements (which may indicate either tool defects or routine
algorithm overrides for which the tool should be extended).

## 3. Aim

To measure the concordance between the algorithm-recommended
investigation and the actual documented clinical decision across a
consecutive sample of 2WW colorectal referrals seen at George Eliot
Hospital.

## 4. Objectives

**Primary objective**

- Determine overall concordance rate between tool recommendation and
  documented clinical decision.

**Secondary objectives**

- Determine concordance rate per algorithm arm (IDA, CIBH/bleeding,
  asymptomatic FIT+, weight loss, mass, routing exception).
- Characterise patterns of mismatch (was the tool's recommendation
  systematically more or less aggressive?).
- Measure time taken per case (an operational outcome — relevant for
  future deployment planning).
- Identify candidate refinements to the encoded algorithm or to the
  Trust algorithm document.

## 5. Design

Single-centre, retrospective, consecutive-case concordance audit.

## 6. Population

**Inclusion criteria**

- Adults referred under the 2WW colorectal pathway and seen at George
  Eliot Hospital in the audit window (most recent **N consecutive**
  clinic letters per clinician where N is determined by the sample
  size, see Section 8).
- Documented clinic outcome including chosen investigation.

**Exclusion criteria**

- Did not attend (no documented outcome).
- Discharged before assessment (e.g. duplicate referral, withdrawn
  consent).
- Outcome already captured under a different pathway (e.g. an obvious
  cancer referred directly to MDT — no investigation pathway choice
  applied).

## 7. Data sources

- Clinic letters in the Trust EPR / clinical portal.
- Blood results retrieved from the Trust Lab system as documented in the
  clinic letter (no separate Lab queries required).
- FIT results as documented in the referral or clinic letter.

## 8. Sample size

100 consecutive cases per reviewing FY1, with a minimum total of 100 if a
single FY1 reviews. Power calculation (one-sided exact binomial):

- Expected concordance ≥ 80%: 100 cases gives a 95% confidence interval
  width of ≈ ±8 percentage points.
- This is sufficient precision for an internal audit. Multi-FY1 review
  also enables inter-rater agreement (κ) as a secondary analysis.

## 9. Data collection — what the FY1 enters

For each consecutive eligible case, the FY1 (one of the assigned team)
opens the audit tool at `[tool URL]/#/audit/new` and enters the
following from the clinic letter:

**Audit-only metadata (no PID):**

- FY1 initials (e.g. "AB")
- Clinic month (YYYY-MM only — no specific day to avoid traceable identifiers)
- Auto-generated audit ID (e.g. `AUDIT-2026-0001`)

**Clinical findings (extracted verbatim from clinic letter):**

- Age band, sex, WHO score
- Referral reason(s)
- Bloods: Hb, MCV, ferritin, FIT (within 3 months of clinic visit)
- Symptoms: change in bowel habit (+duration), rectal bleeding type,
  tenesmus, mucus PR, abdominal pain, weight loss (+kg)
- Examination: palpable abdominal mass, palpable rectal mass, tender
  rectal mass
- History: family CRC/IBD, previous CRC, IBD, recent colonoscopy <2y
- Procedure fitness: fit for bowel prep, mobility aids, ADL
  independence, overnight escort available
- Capacity for telephone clinic

**Outcome captured:**

- Actual clinical decision (chosen investigation from documented
  outcome).
- Outcome notes (free text — e.g. "consultant override for FHx",
  "patient declined").

The tool then automatically:

- Computes the algorithm's recommended investigation.
- Flags concordance (match) or mismatch.
- Records the algorithm version and the node ID traversed.
- Records the time taken to enter the case.

## 10. Analysis

**Primary**

- Overall concordance rate (proportion of cases where
  `toolDecision === actualDecision`), with 95% confidence interval.

**Secondary**

- Concordance rate by algorithm arm (IDA / mass / CIBH / asymptomatic
  FIT+ / weight loss / routing).
- Confusion matrix of (toolDecision × actualDecision).
- Top mismatch patterns (which tool recommendation gets overridden to
  which actual decision, and how often).
- Mean and IQR time per case in seconds.
- Cohen's κ (if multiple reviewers — for inter-rater agreement on the
  same cases).

**Pre-specified subgroup analyses**

- By referral reason (CIBH alone, rectal bleeding alone, IDA, weight
  loss, etc.).
- By age band (<60, 60–79, ≥80).
- By bowel-prep fitness (yes/no).

## 11. Data handling

- **No patient identifiable data is collected.** No NHS number, name,
  date of birth, hospital number, or full clinic date.
- Data is stored against an auto-generated audit ID in a secure
  cloud-hosted Vercel KV store (London edge region, encrypted at rest
  and in transit).
- The audit dataset is exportable as CSV from the tool. The export
  contains no PID and is suitable for inclusion as a study appendix.
- Retention: audit data retained for the duration of the audit + 7
  years per Trust Records Management policy. To be transferred to the
  Trust audit office on completion.

## 12. Ethical and governance considerations

- **Clinical audit, not research.** Patient consent not required (no
  change to care; no PID extracted).
- **Anonymous data extraction** is being undertaken by clinicians as
  part of routine quality-improvement activity.
- **No change to clinical care** during the audit — the tool's
  recommendation is *not* shown to or used by the consultant during the
  index clinic visit. Cases are reviewed retrospectively.
- **Trust Audit & QI office registration** to be obtained before
  commencement. Audit ID: [to be assigned].
- **Caldicott approval** not required — no PID processed.
- **Information Governance**: data resides in a Trust-controlled
  cloud-hosted system; lawful basis for processing
  (GDPR Art 6(1)(e) — public task, Art 9(2)(h) — health and social care).

## 13. Risks

| Risk | Mitigation |
|------|------------|
| FY1 enters incorrect data from the letter | Two-clinician spot-check of 10% of cases for fidelity |
| FY1 unblinded to actual outcome at time of entry biases data extraction | The tool requires entry of clinical findings before the actual outcome field is enabled; analysis can also separately measure inter-FY1 agreement on data extraction |
| Sample not representative | Use consecutive eligible cases from defined date range; document any exclusions and reasons |
| Tool encoding error revealed | Halt audit, fix tool (engine version bumped), re-audit; algorithm version stamp on every case enables clean separation |
| PID accidentally entered | Tool rejects any free-text field longer than schema permits; FY1 training emphasises no PID |

## 14. Roles

| Role | Person |
|------|--------|
| Audit lead clinician | [Your name] |
| Senior endorsement / supervisor | Mr Kasun |
| Reviewing FY1s | [Names], colorectal team |
| Tool maintenance | [Your name] |
| Statistical advice | [TBC if needed] |
| Trust audit office contact | [TBC] |

## 15. Outputs

- Audit report (executive summary + full analysis) — to colorectal MDT
  and divisional clinical governance committee.
- CSV dataset (anonymised) for audit office.
- Recommendations:
  - For the algorithm encoding (any defects identified)
  - For the Trust algorithm document (any arms found ambiguous in
    practice)
  - For deployment readiness (does the concordance support proceeding
    to Phase 2 patient-form pilot?)

## 16. Timeline

| Week | Activity |
|------|----------|
| 0    | Trust audit office registration; FY1 orientation; pilot run of 10 cases |
| 1–4  | Data entry: ~25 cases/FY1/week |
| 5    | Data cleaning, mismatch review |
| 6    | Analysis, report drafting |
| 7    | Presentation to colorectal MDT |
| 8    | Submission to divisional clinical governance |

## 17. Stop criteria

The audit will pause and the tool be reviewed if any of the following
emerge in the first 25 cases:

- Overall concordance below 60% (suggests systematic issue requiring tool
  or algorithm review before continuing).
- A specific arm with <50% concordance and ≥5 cases (suggests defect in
  that arm).
- Any patient safety concern raised by a reviewing clinician on a
  specific case.

---

**End of protocol.**
