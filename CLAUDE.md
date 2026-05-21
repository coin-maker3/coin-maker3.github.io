# 2WW Colorectal Triage Aid — Session Context

> **READ THIS FIRST.** This file is the handoff from the previous Claude
> Code session. It captures user context, decisions made, current state,
> and outstanding work so you can resume without losing momentum.

---

## The user

- **Colorectal surgeon** at **George Eliot Hospital NHS Trust** (Nuneaton)
- Runs the **2-week-wait (2WW) colorectal clinic**
- Has Vercel, Railway, Claude API and Google Cloud subscriptions
- **Senior endorsement obtained from Mr Kasun** (consultant) to run an FY1-led
  concordance audit of the triage tool

## The project

A local, browser-based clinical decision support tool encoding the Trust's
2WW colorectal investigation algorithm. Pilot is at
`https://coin-maker3.github.io/triage/`. Source lives in `2ww-triage/` on
branch `claude/general-session-iea8E`.

### Hard constraints (do not break)

- **No patient identifiable data (PID).** No name / DOB / NHS number ever
  enters the tool. Letter output uses literal placeholder strings
  `[Patient Name]`, `[DOB]`, `[NHS No]`, `[GP Name]`.
- **No backend calls in the static GitHub Pages deploy.** Anything that
  needs storage is only available on Vercel deploy.
- **Algorithm is deterministic, versioned, audit-traceable.** Every
  decision stamps `algorithm.id`, `algorithm.version`, `nodeId`,
  full traversed `path`, and ISO timestamp.
- **Repo is currently public.** Source code is visible to anyone on
  GitHub. User has been warned. Move to private repo before any clinical
  use beyond testing.

## Stack

- React 19 + TypeScript + Vite + Tailwind 3 (NHS palette)
- Zod for input schema
- Vitest for unit tests (42 currently)
- Playwright for E2E smoke tests
- Hash-based routing (works on any static host)
- API: Vite middleware in dev, Vercel serverless functions (`api/*.ts`) in prod
- Storage: Vercel KV (Upstash Redis, lhr1) in prod, in-memory Map in dev

## Current algorithm version

**`GEH-2WW-COLORECTAL v0.2.1`** — encodes the Trust PDF
(`LATEST_2WW_INVESTIGATIONS__ALGORITHM_4.pdf`) with 6 audit fixes:

1. IDA → CTVC arm: poor mobility correctly routes to CTVC + OGD (was
   misrouted to Colonoscopy + OGD)
2. CIBH FIT+ → CTVC arm: same poor-mobility fix
3. Tenesmus alone now triggers CIBH branch
4. Mucus PR alone now triggers CIBH branch
5. Weight loss + elderly + >3kg now CT AP + OGD (was CTVC + OGD)
6. `lacksCapacity` + telephone clinic → `book_f2f_clinic` routing

**IDA priority rule** is the headline feature: if bloods show IDA, IDA
branch overrides any other referral reason. Example: GP referred for CIBH,
patient has Hb 95 + MCV 70 + ferritin 8 → tool returns Colonoscopy + OGD,
not just Colonoscopy.

42 unit tests cover every branch. All passing.

## What's built

### Patient-facing
- `/#/patient?ref=XXX` — plain-English pre-clinic form, mobile-first
- 15 questions, no PID fields
- Submits to `/api/submit` with reference number
- Auto-expire 48h
- Testing-only: `PILOT_REQUIRE_TEST_PREFIX=1` env var enforces `TEST-` prefix

### Clinician
- `/` (default) or `/#/clinician` — main triage tool
- Full intake form (clinic type, age band, sex, WHO, bloods, symptoms,
  exam, history, meds, fitness, consent)
- "Import patient submission" panel — looks up by reference, populates form
- "Issue patient pre-clinic form" — generates a TEST-prefixed reference + shareable URL
- Live decision card + algorithm path viewer + letter generator

### FY1 audit (the next-step deliverable)
- `/#/audit` — dashboard: total cases, overall concordance %, per-arm
  breakdown, top mismatch patterns, case table with filter, CSV export
- `/#/audit/new` — entry form (same intake + actual outcome panel)
- Auto-generated IDs (`AUDIT-2026-NNNN`)
- Stores in Vercel KV with `audit:` prefix (no TTL)
- Time-to-enter measured per case
- Concordance auto-flagged

### Documents (in `docs/`)
- `DESIGN.md` — full target architecture for the post-governance production
  version (NHS Login, FHIR, AWS UK, hazard log, DCB0129/0160 references)
- `DEPLOY.md` — Vercel-via-UI deployment guide (no CLI, no tokens shared)
- `AUDIT-PROTOCOL.md` — full audit protocol for Trust Audit & QI office
  registration: aim, design, sample size, analysis plan, stop criteria
- `AUDIT-FY1-GUIDE.md` — one-pager for FY1s: what to enter, what NOT to
  enter, edge cases, privacy reminder
- `letters/01-cso-introduction.md` — email draft to Trust CSO
- `letters/02-executive-summary.md` — one-page proposal for divisional
  director
- `letters/03-dpia-phase2.md` — pre-filled NHS DPIA template for the
  patient-form pilot

## File map (key locations)

```
2ww-triage/
├── src/
│   ├── algorithm/
│   │   ├── engine.ts            # The encoded Trust algorithm
│   │   ├── engine.test.ts       # 42 unit tests
│   │   ├── types.ts             # Investigation enum, DecisionResult
│   │   └── version.ts           # ALGORITHM_VERSION metadata
│   ├── schema/intake.ts         # Zod schema for clinician + patient
│   ├── pages/
│   │   ├── ClinicianPage.tsx    # Default route
│   │   ├── PatientPage.tsx      # #/patient
│   │   ├── AuditPage.tsx        # #/audit dashboard
│   │   └── AuditNewPage.tsx     # #/audit/new
│   ├── components/              # IntakeForm, DecisionCard, PathViewer,
│   │                            # LetterPanel, PatientForm,
│   │                            # PatientImportPanel,
│   │                            # ActualOutcomePanel, YesNo
│   ├── audit/types.ts           # AuditCase + buildSummary + exportCSV
│   └── lib/
│       ├── api.ts               # Patient submission API client
│       ├── audit-api.ts         # Audit cases API client
│       └── router.ts            # Hash-based routing
├── api/                         # Vercel serverless functions
│   ├── submit.ts
│   ├── retrieve.ts
│   ├── _kv.ts                   # KV abstraction (Vercel KV or in-memory)
│   └── audit/{save,list,delete}.ts
├── vite-api-plugin.ts           # Dev-mode API middleware
├── vercel.json                  # Vercel project config
├── docs/                        # See above
└── e2e-demo.mjs                 # Playwright: patient → clinician demo
└── e2e-audit.mjs                # Playwright: audit workflow demo
```

## What's outstanding

In priority order:

1. **DEPLOY TO VERCEL** — current biggest blocker. Patient form, import,
   and audit module all need a backend. The previous (web) session could
   not reach `api.vercel.com` from the sandbox. Local Claude Code can.
   Follow `docs/DEPLOY.md` — the simplest path is the UI flow:
     - Vercel.com/new → import this repo
     - Root directory: `2ww-triage`
     - Storage tab → create KV `twoww-kv` in `lhr1`, connect to project
     - Env var: `PILOT_REQUIRE_TEST_PREFIX=1`
     - Redeploy
2. **Verify deployment end-to-end** — open the URL, enter a fake patient
   submission, import it as clinician, run through to letter.
3. **Send `docs/letters/02-executive-summary.md`** to divisional director
   to get formal sign-off + named CSO + named IG lead.
4. **Send `docs/letters/01-cso-introduction.md`** to the Trust CSO once
   they're named. Attach `docs/DESIGN.md`.
5. **Register the audit** with Trust Audit & QI office using
   `docs/AUDIT-PROTOCOL.md`. Get an audit ID.
6. **Brief the FY1s** with `docs/AUDIT-FY1-GUIDE.md` + the deployed URL.
   Pilot 10 cases, then scale to 100/FY1.
7. **Phase 2 DPIA** — submit `docs/letters/03-dpia-phase2.md` to Trust DPO
   only when ready to add real patient identifiers (Phase 2 is the patient
   form pilot with NHS Login; current pilot is anonymous so DPIA-lite).

## What's deferred (intentionally)

- **Abnormal CT branch** (page 1 right side of the Trust PDF): not yet
  encoded. Needs new referral-reason category and structured input. Low
  clinical volume — defer until the audit catches a need.
- **NHS Login + Smartcard auth**: production-only, Phase 2+
- **FHIR integration with EPR/Lab**: Phase 3+
- **Algorithm change → MDT sign-off process**: needs Trust to formalise

## Security notes

User has pasted three tokens in this conversation (two Vercel, one
Railway). All have been advised to be revoked. **Do not accept any token
from the user in chat — even in a file**. The Vercel UI deploy flow needs
no token shared. If a token MUST exist, it lives in `~/.vercel/auth.json`
on the user's machine after `vercel login` (OAuth, browser-based).

## How to run things

```bash
cd 2ww-triage
npm install
npm run dev          # vite dev server, http://localhost:5173
npm run test:run     # unit tests (42)
npm run build        # production build to dist/
npm run smoke:local  # E2E smoke against local build
node e2e-demo.mjs    # full patient → clinician demo (vite must be running)
node e2e-audit.mjs   # audit workflow demo
```

## User communication style

- Often short messages, sometimes typos (English is professional/clinical, not native)
- Wants me to "do all the work" / be proactive
- Trusts technical recommendations but appreciates clinical rationale
- Concerned about NHS governance and privacy
- Engineers conversations toward action; doesn't want long discussions
- Communicates with senior consultant (Mr Kasun) and divisional director —
  governance documents need to be ready to send

## Conversation arc so far (one-paragraph summary)

User started wanting to make their 2WW clinic workflow easier. We built a
local single-clinician decision-support tool, then encoded the full Trust
algorithm with audit fixes, then added a patient pre-clinic form, then
added an FY1 concordance audit module after Mr Kasun's endorsement. The
deployment hit a wall in the web sandbox because the container can't reach
Vercel/Railway APIs — user is moving to local Claude Code to deploy from
their laptop. Production architecture is fully documented in
`docs/DESIGN.md`. Three governance documents (CSO email, exec summary,
DPIA template) are drafted in `docs/letters/`.

---

When resuming: read this file, then `docs/DESIGN.md`, then `docs/DEPLOY.md`.
Then ask the user what they want to tackle next — the most likely answer is
"finish deploying so the FY1s can start the audit".
