# PathwayPack — CESR Evidence Engine

A tool for UK doctors applying for GMC specialist registration via the
**Portfolio Pathway** (formerly CESR). Applicants upload evidence documents
(PDFs, certificate photos, appraisal docs, employment letters). The system
extracts, classifies, and maps every item to the GMC's **Capabilities in
Practice (CiPs)** framework per the specialty-specific guidance (SSG), then
generates a GMC-format CV, an evidence index, a gap report, a consistency
report, and a redaction pre-flight.

> **The CV is an output, not the product. The evidence engine is the product.**

Specialty scope for v1: **General Surgery SSG only.** Design partner / golden
user: Mr. Shuker (Consultant, General Surgery). His live application is the
acceptance test. Do not generalise to other specialties until the GS pipeline
passes his real documents.

---

## HARD RULES — never violate

These are enforced in code, not just documented. See `backend/tests/` and
`backend/app/rules/loader.py`.

1. **No fabrication.** This tool extracts, structures, formats, and flags. It
   NEVER writes reflections, invents audit outcomes, or embellishes job
   descriptions. If a field cannot be extracted from source documents it is
   left blank and surfaced in the gap report — **never inferred.** (GMC interim
   AI guidance: AI may assist organisation and presentation; all content must
   reflect the applicant's own experience.)
2. **Redaction-first.** Any extracted text containing patient identifiers
   (names, DOB, NHS numbers, hospital numbers, addresses) or colleague GMC
   numbers is flagged and masked in **all** outputs. Unredacted evidence gets
   deleted by the GMC and forces resubmission — this is a hard failure mode we
   exist to prevent. See `app/pipeline/redaction.py`.
3. **No evidence documents committed to GitHub.** User documents live in object
   storage / MongoDB GridFS only. The repo contains code and rules JSON only.
   See `.gitignore`.
4. **Public product is upload-only.** No Gmail OAuth in the public build. The
   Gmail ingestion adapter (Phase 5) exists only behind the `PERSONAL_MODE`
   env flag, testing-mode OAuth, single user (Ali), and is excluded from any
   deployed public instance.
5. **All GMC rules externalised as JSON** (`rules/*.json`), never hardcoded in
   application logic. Every rules file carries a `verified_against` object
   citing the GMC source URL and date. **Production is gated on manual
   verification of every rule against the live GMC pages** — the rules loader
   refuses to serve unverified rules unless `ALLOW_UNVERIFIED_RULES=1`
   (dev only).
6. **CV-must-match invariant.** The consistency checker runs on every
   generation and blocks "export" with **warnings, not errors** — the user can
   override but sees exactly what mismatches (dates/titles/posts) exist between
   the CV, employment letters, and extracted evidence.

---

## Architecture

```
ingest → extract → redaction scan → classify → map (GS SSG CiPs) → aggregate → generate
```

Each stage writes its status to the document record. **Failures are visible,
never silent.** Extraction confidence below threshold routes the document to a
"needs review" queue — the user confirms or corrects, and corrections feed the
record, not the model.

- **Backend:** FastAPI (Railway). `backend/`
- **Frontend:** React (Vite + Tailwind, Vercel). `frontend/` — scaffold only in
  this phase.
- **DB:** MongoDB Atlas — collections: `applicants`, `documents`,
  `career_events`, `evidence_items`, `cip_mappings`, `reports`.
- **Extraction:** Anthropic API (vision for photos/scans, text for PDFs);
  Gemini as fallback.
- **docx generation:** python-docx, server-side.
- **Auth:** email magic link for v1 (Shuker + Ali only). No public signup until
  the golden test passes.

## Data model

| Collection      | Purpose |
|-----------------|---------|
| `applicants`    | profile, specialty, target SSG version |
| `documents`     | raw uploads, extraction status, redaction flags, generated GMC-compliant title, source (`upload`\|`gmail`) |
| `career_events` | posts held: title, grade, employer, dates, WTE %, type (substantive/fixed-term/locum); gaps auto-detected |
| `evidence_items`| atomic extracted claims (audit, course, WBA, publication, teaching) — each linked to source document + confidence score |
| `cip_mappings`  | `evidence_item → CiP/HLO` per GS SSG, with mapping-rationale string |
| `reports`       | generated CV / gap / consistency reports (immutable, timestamped) |

## Phases & acceptance gates

- **Phase 1 — Extraction core.** Upload → extract → structured `career_events`
  + `evidence_items`. Acceptance: 10 of Shuker's real (dev-redacted) docs,
  ≥90% of dates/titles/employers extracted correctly. *(scaffolded here)*
- **Phase 2 — GMC CV generation.** `career_events` → GMC-format `.docx` per
  `rules/cv_structure.json`. Acceptance: Shuker's line-by-line check passes.
- **Phase 3 — CiP mapping + gap report.** Acceptance: mapping of 20 known items
  agrees with Shuker's manual mapping ≥85%.
- **Phase 4 — Consistency + redaction reports.** Acceptance: seeded set with 5
  planted mismatches + 5 planted identifiers — **100% caught.** Golden tests in
  `backend/tests/golden/`. *(redaction core built here)*
- **Phase 5 — Gmail personal adapter.** Testing-mode OAuth, `PERSONAL_MODE`,
  Ali-only.

## Manual verification gate (before Shuker relies on any output)

- [ ] `cv_structure.json` verified line-by-line against GMC "Structuring your CV
      for a specialist or GP registration application"
- [ ] `document_titling.json` verified against the GMC Online Portfolio
      Application user guide
- [ ] `gs_ssg_cips.json` verified against the current GMC General Surgery SSG
      PDF (check curriculum version — curricula update and change evidence
      requirements)
- [ ] `evidence_currency.json` (last 5–6 years WTE) confirmed against current
      GS SSG
- [ ] `accepted_file_types.json` confirmed (note: multi-sheet Excel must be
      converted to PDF)

Until each `rules/*.json` has a populated `verified_against` block, the loader
treats it as unverified and blocks production use.

## What is built in this first session

- Project skeleton + FastAPI app wiring
- Rules-externalisation pattern **with a hard verification gate**
- Pydantic data model for all core collections
- **Redaction/PII scanner** with real, testable algorithms (NHS-number mod-11
  checksum, GMC number, DOB, NHS/hospital number patterns) — the safety-critical
  layer — plus golden tests with planted identifiers
- Phase-1 extraction pipeline scaffold with per-stage visible status
- Golden-test harness (`tests/golden/`)

See `backend/README.md` to run it.
