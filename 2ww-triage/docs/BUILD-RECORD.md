# 2WW Colorectal Triage Aid — Build Record

*A chronological record of how the tool was designed, built, verified and governed.*
*Prepared for Mr Kasun Wanigasooriya (project lead) and available to the GEH Clinical Audit & QI office / AI Committee.*
*Maintained by Ali Mohamed Elhassan · Last updated 15 July 2026 · Companion documents: Technical Factsheet (AI & Data Handling), Algorithm Overview, Audit Protocol, Project Log.*

---

## 1. What was built

A web-based **deterministic calculator** encoding George Eliot Hospital's approved 2WW
colorectal investigation algorithm as a fixed, testable decision tree, plus an audit
entry page that lets a reviewer enter an anonymised case, see the algorithm's
recommendation with its full reasoning path, record the clinician's actual decision,
and copy one spreadsheet row into the department's controlled Teams workbook.

**The tool contains no artificial intelligence at runtime.** Identical inputs always
produce identical outputs; every output is stamped with the algorithm version and shows
the exact steps followed.

| Item | Value |
|---|---|
| Tool URL | https://ww-colerectal.web.app/audit/new |
| Algorithm version | GEH-2WW-COLORECTAL v0.4.0 |
| Automated tests | 95, all passing; the full suite runs before any deployment |
| Hosting | Firebase (Google), London region (europe-west2), project-owned |
| Data stored by the tool | None — stateless calculator; audit data lives only in the Trust Teams workbook |
| Source of clinical logic | The Trust's 2WW colorectal pathway document, encoded branch-by-branch (see Algorithm Overview) |
| Cost / vendor / licence | None — built in-house by the project team |

## 2. How it was built — chronology

| Date (2026) | What was done |
|---|---|
| 20 May | Project scaffolded. First encoding of the Trust 2WW algorithm (v0.1 → v0.2), including the iron-deficiency-anaemia priority rule. Automated end-to-end smoke test added from day one. |
| 20 May | v0.2.1 — six algorithm corrections found by self-audit against the Trust document, each captured as a permanent regression test. |
| 21 May | Concordance-audit module added (reviewer entry workflow + analysis dashboard). Governance documents drafted (audit protocol, reviewer guide, design document). |
| 24 May | v0.3.0 → v0.4.0 — "No rectal mass" sub-branch, Abnormal-CT branch, structured prior-bowel-surgery and bleeding-source fields, free-text scanner for clinically material phrases, CTVC <2y routing exception. Statistical dashboard brought in line with the protocol (Wilson 95% CIs, Cohen's kappa, confusion matrix, pre-specified subgroups, stop-criteria alert). Test suite grown to 86, then 95. |
| 25 May | Audit workflow v0.5 — cohort tracking, custom audit IDs, structured exclusion handling with denominator transparency. "FY1" renamed "Reviewer" throughout (audit open to any grade). |
| 28–29 Jun | Reviewed by Mr Wanigasooriya (consultant colorectal surgeon, project lead) — endorsed; team formed. At his request the patient-facing referral-upload pathway was **disabled in code** (server rejects such submissions). Structured discordance capture added, as he approved: on any mismatch the reviewer must record a reason and a safety direction, with "clinician did less than the tool" flagged as the potential under-investigation signal. Hosting moved to Firebase London under project ownership. |
| 1 Jul | **Information-governance review of the data flow.** Decision: the tool holds and transmits no patient data at all. All persistence removed from the workflow — the reviewer copies a single row into a controlled-access Excel workbook inside the department's Microsoft Teams (same in-tenant model as the department's M&M and handover sheets; MRN permitted as the case identifier because data never leaves the Trust tenant). An automated Power Automate submission flow was assessed and **rejected** to keep the tool at zero data transmission. Final-diagnosis field added so cancer outcomes can be analysed against recommendations. Audit workbook (38 columns, Guide sheet, live Summary sheet with concordance % and the cancer-safety measure) built and pinned in the "AI 2WW Project" Teams channel. |
| 2 Jul | **Live and collecting.** Tool verified end-to-end: test case marks correctly, copied row matches the workbook's 38 columns, incomplete entries are rejected. |
| 7 Jul | Clinical Audit office query about AI answered (Mr Wanigasooriya); Technical Factsheet prepared covering the AI and data-handling position. |

## 3. How correctness is assured

1. **Explicit, versioned rules.** The algorithm is code that mirrors the Trust document
   branch-by-branch; the mapping is written out in the Algorithm Overview for clinical
   review. Nothing is inferred or learned.
2. **95 automated tests.** Every branch has test cases with expected outcomes
   (including the historical corrections from self-audit, kept as regression tests).
   The full suite must pass before any deployment.
3. **Traceable outputs.** Every recommendation displays the path taken — each rule
   fired, the evidence used, and the algorithm version — so any single case can be
   checked by hand against the Trust document.
4. **Structured discordance capture.** Where the clinician's actual decision differs
   from the tool, the reviewer classifies why and in which safety direction, so
   algorithm errors surface quickly and under-investigation risk is flagged red.
5. **Change control.** Any change to clinical logic requires: consultant agreement,
   a version bump, tests covering the change, and the full suite passing — then the
   change is recorded in the Project Log.

## 4. Role of AI in development

An AI coding assistant (**Claude, by Anthropic** — free of charge in the form used) was
used **during software development** to help write the code, as such assistants are now
routinely used in software engineering. The clinical logic came from the Trust's
algorithm document and the clinical team's direction; the resulting code is
deterministic, human-reviewed, version-controlled and covered by the test suite.
**No AI runs in the deployed tool, and no patient data of any kind was used in or sent
to any AI system at any stage.**

## 5. Data-handling position (summary)

- The tool **stores and transmits nothing** — no database behind the form; the
  patient-upload pathway is disabled at server level.
- Audit data exists **only** in the controlled-access workbook in the Trust's Teams
  tenant; MRN stays inside Trust systems; nothing identifiable leaves them.
- A pilot banner on every page states the tool is for audit use only and is not a
  Trust-endorsed clinical decision support tool; recommendations are not used in
  patient care (the audit is retrospective).

---

*Full detail: Technical Factsheet (AI & Data Handling) · Algorithm Overview ·
Audit Protocol · Project Log. Source code, test suite and version history are
available for inspection on request.*
