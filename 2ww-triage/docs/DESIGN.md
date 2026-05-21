# 2WW Colorectal Triage — Production Design

This is the design for the **post-governance** production version of the 2WW
Colorectal Triage Aid. Use it as the working document with the Trust IG team,
Clinical Safety Officer (CSO), Caldicott Guardian and IT.

The current pilot at `https://coin-maker3.github.io/triage/` is intended as
proof-of-concept only. This document describes the system that replaces it
once governance is cleared.

- **Status:** design draft
- **Author:** GEH colorectal pilot
- **Algorithm version baseline:** `GEH-2WW-COLORECTAL v0.2.1`

---

## 1. Goal

Compress the time and cognitive load of the 2WW colorectal clinic by:

1. Letting **patients** answer plain-English symptom questions before clinic.
2. Letting **clinicians** validate (not re-collect) those answers, add bloods
   and examination findings, and receive an algorithm-supported recommendation
   in real time.
3. Writing the **outcome and letter** straight back into the Trust EPR.

Success looks like: a 30-minute clinic appointment becomes a 10-minute
validation, every decision is reproducible and audit-traceable to the
encoded Trust algorithm version, and zero patient data lives outside the
Trust governance perimeter.

---

## 2. Users and contexts

| User           | Channel                        | Identity                |
|----------------|--------------------------------|-------------------------|
| Patient        | Web (mobile-first), pre-clinic | **NHS Login**           |
| Patient (assisted) | In-clinic kiosk / nurse tablet | None (kiosk session) |
| Clinician      | Trust device, on HSCN          | **NHSmail OAuth** or **Smartcard (CIS2)** |
| Clinical Safety Officer | Audit/MI dashboard    | NHSmail OAuth (role: CSO) |
| Information Asset Owner | Audit/MI dashboard    | NHSmail OAuth (role: IAO) |

---

## 3. Architecture (target state)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Trust governance perimeter                          │
│                                                                          │
│   ┌──────────────┐    ┌────────────────────┐    ┌──────────────────┐   │
│   │   Patient    │    │   Clinician        │    │   Audit & MI     │   │
│   │  NHS Login   │    │  Smartcard/NHSmail │    │  (Trust SIEM)    │   │
│   └──────┬───────┘    └─────────┬──────────┘    └────────▲─────────┘   │
│          │                      │                         │             │
│          ▼                      ▼                         │             │
│   ┌──────────────────────────────────────┐               │             │
│   │  Web app (React + TypeScript)        │               │             │
│   │  - /patient   plain-English form     │               │             │
│   │  - /clinician validate + decide      │───────────────┤             │
│   │  - /audit     CSO/IAO dashboard      │               │             │
│   └──────────────────┬───────────────────┘               │             │
│                      │ HTTPS                              │             │
│                      ▼                                    │             │
│   ┌──────────────────────────────────────┐               │             │
│   │  Backend API (NestJS, AWS eu-west-2) │───────────────┘             │
│   │  - Session store (RDS Postgres, KMS) │                             │
│   │  - Algorithm engine (versioned, same │                             │
│   │    code as pilot, server-side)       │                             │
│   │  - Append-only audit log             │                             │
│   └──────────────────┬───────────────────┘                             │
│                      │                                                  │
│                      ▼ HL7 FHIR R4                                      │
│   ┌──────────────────────────────────────┐                             │
│   │  Trust EPR / PAS / Lab               │                             │
│   │  read: bloods, appts, prior scopes   │                             │
│   │  write: clinic letter, outcome code  │                             │
│   └──────────────────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. User flows

### 4.1 Patient flow (pre-clinic)

1. Trust appointment booking system sends SMS/email with a short URL plus
   appointment ID:
   `https://2ww.geh.nhs.uk/patient?appt=ABC123`
2. Patient signs in with **NHS Login** (proves identity to NHS standard,
   removes anonymity concerns, and lets us match the submission to the
   appointment).
3. Plain-English questionnaire (see Section 6.1).
4. On submit, answers are saved server-side under the encounter ID and
   marked `patient-confirmed`.
5. Patient sees confirmation: "Your answers have been sent to the clinic.
   Bring your appointment letter."
6. *If patient cannot/will not complete online*: clinic reception offers a
   kiosk-mode tablet on arrival, or a clinic nurse fills it with them.

### 4.2 Clinician flow (in clinic)

1. Clinician opens `/clinician`, signed in by Smartcard or NHSmail.
2. Sees today's 2WW colorectal clinic list with a tick beside each patient
   who has pre-completed.
3. Clicks a patient row → triage screen opens with:
   - Left column: patient-supplied answers (read-only, highlighted as
     "patient-confirmed")
   - Right column: bloods auto-fetched from Lab via FHIR, prior
     investigations from EPR
4. Clinician examines the patient (F2F) or talks to them (Tel), validates
   answers, edits any that need correcting (every edit recorded in audit),
   adds bloods/exam findings the system couldn't fetch.
5. Algorithm card on the right updates live with the recommended
   investigation, full algorithm path, and alternatives.
6. Clinician confirms or overrides (override requires a free-text reason).
7. Single "Submit outcome" button:
   - Writes clinic letter back to EPR via FHIR `DocumentReference`
   - Writes coded outcome (SNOMED CT) as the encounter outcome
   - Closes the audit record for that encounter

### 4.3 Audit / MI dashboard

For CSO/IAO/clinical lead:

- Decisions per algorithm version
- Per-node frequency (which arms get used)
- Override rate per arm
- Time from referral to decision
- All actions queryable and exportable
- 7-year append-only retention (NHS standard)

---

## 5. Data model

### 5.1 What we store

Five tables, all in encrypted Postgres (AWS RDS, KMS-managed keys).

```
encounter
  id                uuid (pk)
  trust_encounter_id text (from PAS, indexed)
  nhs_number_hash   text (sha-256 + per-Trust pepper; never the raw number)
  patient_nhs_login_subject text (opaque NHS Login subject ID, optional)
  appointment_at    timestamptz
  clinic_type       enum('telephone','face_to_face')
  status            enum('awaiting_patient','patient_complete','clinician_complete','overridden')
  created_at        timestamptz
  closed_at         timestamptz

intake_patient
  encounter_id      uuid (fk)
  payload           jsonb   -- patient-supplied answers (no PID)
  submitted_at      timestamptz
  patient_user_agent text  -- audit; never linked to identifiable session

intake_clinician
  encounter_id      uuid (fk)
  payload           jsonb   -- clinician-validated/added answers
  validated_at      timestamptz
  clinician_id      text    -- CIS2/NHSmail subject

decision
  encounter_id      uuid (fk)
  algorithm_id      text
  algorithm_version text
  node_id           text
  investigation     text
  path              jsonb
  warnings          text[]
  computed_at       timestamptz
  override          jsonb   -- {byClinicianId, reason, newInvestigation} | null

audit_event
  id                uuid (pk)
  encounter_id      uuid
  actor             text    -- patient | clinician_id | system
  action            text    -- created | edited | submitted | override | viewed
  before_jsonb      jsonb
  after_jsonb       jsonb
  ip                text
  user_agent        text
  at                timestamptz
```

### 5.2 Key data-protection choices

- **NHS number is never stored in plaintext.** Only a salted hash for joining
  to encounters by external query (e.g., when EPR sends a referral update).
- **Patient symptom answers contain no free-text identifiers** — the patient
  form has no name/DOB/NHS field; identity comes from NHS Login OAuth.
- **All data resides in AWS UK (eu-west-2)** in a Trust-controlled account.
  Data never leaves the UK.
- **KMS-managed encryption at rest, TLS 1.3 in transit.**
- **Field-level pseudonymisation** for any payloads sent off-platform
  (e.g., MI exports).

---

## 6. Patient and clinician questionnaires

### 6.1 Patient questionnaire (plain English)

(To be clinically reviewed before deployment — this is the v1 draft.)

1. How old are you? (drop-down by age band)
2. Are you male or female?
3. **In the last few weeks…**
   - Have you noticed any change in your bowel habit (going more, less, or
     differently than usual)? *Yes/No → if yes, "for how many weeks?"*
   - Have you noticed blood when you go to the toilet?
     - *No / Bright red / Dark / Mixed in the stool*
   - Have you noticed mucus or slime in your poo? *Yes/No*
   - Have you had a feeling that you haven't completely emptied your bowels
     even after going to the toilet? *Yes/No*
   - Have you had tummy (abdominal) pain that's new or different? *Yes/No*
4. **Weight**:
   - Have you lost weight without trying? *Yes/No → if yes, how much (kg)?*
5. **Your family and history**:
   - Has anyone in your immediate family had bowel cancer or inflammatory
     bowel disease (Crohn's or colitis)? *Yes/No*
   - Have you ever been diagnosed with bowel cancer before? *Yes/No*
   - Have you ever been diagnosed with Crohn's disease or ulcerative
     colitis? *Yes/No*
   - Have you had a colonoscopy or CT colonography in the last 2 years?
     *Yes/No → what was the result?*
6. **Today**:
   - Do you currently take any blood-thinning tablets like warfarin,
     apixaban, rivaroxaban, clopidogrel or aspirin? *Yes/No → which?*
   - Do you have any allergies?
7. **For your appointment**:
   - Can you stop eating the day before the test if asked? *Yes/No*
   - Can someone stay with you the night after a procedure with sedation?
     *Yes/No*

Plain language reviewed against NHS Service Manual content standards (WCAG 2.2 AA).

### 6.2 Clinician validation form

Identical schema to current pilot. Adds:

- Bloods (Hb, MCV, ferritin, GFR, FIT) — **auto-fetched** from Lab via FHIR
  Observation read, with manual override
- Prior investigations — **auto-fetched** from EPR via FHIR Procedure read
- Examination findings (DRE, abdo mass, rectal mass) — clinician enters
- Anticoag/antiplatelet specifics — clinician validates/edits
- Override field with mandatory reason

---

## 7. Algorithm engine

Same encoding as the pilot. Key requirements going to production:

- **Versioned** in `src/algorithm/version.ts`. Every decision stamps
  `algorithm.id`, `algorithm.version`, `node_id`, `path`, `computed_at`.
- **Pure-functional, no side effects.** Same input → same output, always.
  This is what makes the algorithm clinically reviewable.
- **100% test coverage** per branch (currently 42 tests; target 100% per
  node before release).
- **Algorithm change process:**
  1. MDT signs off new Trust algorithm version
  2. Engineer encodes new branches with new node IDs
  3. New version bumped (e.g., 0.3.0)
  4. CSO reviews diff between encoded engine and new PDF
  5. Test suite extended to cover new nodes
  6. Released; old decisions remain reproducible

---

## 8. Integrations

| Integration              | Direction | Protocol      | Required for…                |
|--------------------------|-----------|---------------|------------------------------|
| NHS Login                | Inbound   | OIDC          | Patient identity             |
| CIS2 / Smartcard or NHSmail | Inbound | OIDC          | Clinician identity           |
| Trust PAS                | Pull      | HL7 FHIR R4   | Appointment list, encounter  |
| Trust Lab (ICE / WinPath) | Pull     | HL7 FHIR R4 (Observation) | Bloods, FIT     |
| Trust EPR                | Pull      | HL7 FHIR R4 (Procedure / DocumentReference) | Prior scopes, clinic letters |
| Trust EPR                | Push      | HL7 FHIR R4 (DocumentReference, encounter outcome SNOMED) | Letter + outcome |
| Trust SIEM               | Push      | Syslog / Splunk HEC | Audit log shipping       |

If any of these aren't available as FHIR, fall back to:
- SQL read replicas (read-only credentials, in Trust network)
- Message-queue feeds (TIE / Mirth)
- CSV exports (last resort, batch refresh)

---

## 9. Hosting and security

- **AWS UK eu-west-2** in a Trust-owned AWS account.
- **VPC** with private subnets for app + database. Only the ALB has public
  ingress, and only behind WAF + Cloudflare in front (Trust may require
  HSCN-only ingress for clinician routes).
- **Two ALB listeners:**
  - `2ww.geh.nhs.uk/patient/*` — public, NHS Login–authenticated
  - `2ww.geh.nhs.uk/clinician/*` — HSCN-only, Smartcard/NHSmail-authenticated
- **Postgres on RDS Multi-AZ**, encrypted with KMS.
- **Backups:** point-in-time recovery 30 days, daily snapshots 7-year
  retention, replicated to a separate AWS account for DR.
- **Secrets** in AWS Secrets Manager. No env vars on disk.
- **CSP, HSTS, X-Frame-Options, CORS**: locked down per OWASP ASVS L2.
- **Logging**: structured JSON, shipped to Trust SIEM. No PII in app logs.
- **Pen-tested** by CHECK-approved tester before go-live and annually.

---

## 10. Clinical safety case (DCB0129 supplier side)

The CSO will produce a Clinical Safety Case File. Inputs we provide:

- Hazard log (initial set drafted below)
- Algorithm version history + diffs
- Test coverage report per node
- Override audit data
- Override-rate review (quarterly)
- Adverse event reporting workflow

### 10.1 Initial hazard log (illustrative)

| ID    | Hazard                                                       | Severity | Likelihood | Mitigation                                                                                            | Residual risk |
|-------|--------------------------------------------------------------|----------|------------|-------------------------------------------------------------------------------------------------------|---------------|
| H-001 | Algorithm encoding diverges from Trust PDF                   | Major    | Low        | MDT signs off algorithm version; CSO reviews diff before release; node IDs traceable to PDF          | Low           |
| H-002 | Patient enters incorrect symptoms                            | Moderate | Medium     | Clinician validates every patient-supplied field; patient-confirmed answers are highlighted, not hidden | Low           |
| H-003 | Wrong bloods displayed (FHIR fetch error)                    | Major    | Low        | Source date and method shown next to every blood value; clinician must confirm before submit          | Low           |
| H-004 | Clinician misses important clinical context (e.g. recent CT) | Major    | Low        | "Prior investigations" panel is mandatory to review; checkbox to confirm read before submit            | Low           |
| H-005 | Algorithm version drifts without CSO awareness               | Major    | Low        | Algorithm version is on every decision letter; deployments require CSO sign-off                       | Very low      |
| H-006 | Patient identity mismatch (wrong patient's answers loaded)   | Major    | Low        | Encounter ID binds NHS Login subject to PAS appointment; cross-check displayed on triage screen        | Very low      |

### 10.2 Override policy

The clinician can always override. Overrides:

- Require a structured reason from a Trust-approved list + free text
- Are visible in MI dashboard
- Are reviewed quarterly by the colorectal MDT
- If a node's override rate exceeds a threshold (default 20%), MDT reviews
  whether the algorithm needs updating

---

## 11. Governance map — what needs sign-off, by whom

| Item                                | Owner                       | When                |
|-------------------------------------|-----------------------------|---------------------|
| Algorithm version (v0.2.1, future)  | Colorectal MDT lead         | Before each release |
| Clinical Safety Case File (DCB0129) | Supplier-side CSO           | Before pilot        |
| Deployment Safety Case (DCB0160)    | Trust CSO                   | Before deployment   |
| Data Protection Impact Assessment   | Trust DPO + Caldicott       | Before pilot        |
| Information Asset register entry    | Information Asset Owner     | Before pilot        |
| DSPT submission                     | Trust SIRO                  | Annually            |
| DTAC self-assessment                | Project / supplier          | Before pilot        |
| MHRA Class I medical device registration | Project / supplier     | Before pilot        |
| Penetration test                    | CHECK-approved tester       | Before go-live      |
| Information governance sign-off     | Trust IG officer            | Before pilot        |
| Patient information leaflet         | Project + comms             | Before pilot        |
| Clinician training package          | Clinical lead               | Before each release |

---

## 12. Tech stack (target)

| Layer        | Technology                               | Reason                          |
|--------------|------------------------------------------|---------------------------------|
| Frontend     | React 19 + TypeScript + Tailwind         | Reused from pilot; mature       |
| Components   | Radix UI + shadcn/ui                     | WCAG 2.2 AA accessible          |
| Forms        | React Hook Form + Zod                    | Type-safe, validated            |
| API client   | TanStack Query                           | Caching, retries                |
| Backend      | NestJS (Node) + TypeScript               | Same language end-to-end, DI    |
| Algorithm    | Shared TypeScript package (`@geh/triage-algorithm`) | Same engine on client + server |
| Database     | Postgres 16 on AWS RDS                   | Mature, Trust-compatible        |
| Search       | Postgres FTS (no Elasticsearch needed)   | Keep stack small                |
| Queue        | AWS SQS (if needed for FHIR retries)     | Managed                         |
| Identity     | NHS Login (patient), CIS2 / Azure AD (clinician) | NHS standard            |
| FHIR client  | `node-fhir-client` (medplum or custom)   | R4 spec compliant               |
| Hosting      | AWS UK (eu-west-2), ECS Fargate          | Trust-approved cloud            |
| CDN          | CloudFront + WAF                         | UK edge, OWASP rules            |
| Audit ship   | Vector or Fluent Bit → Trust Splunk      | Standard                        |
| CI/CD        | GitHub Actions + AWS CodeDeploy          | Reuses pilot CI                 |

---

## 13. Phased rollout

| Phase | Scope                          | Users               | Duration | Governance         |
|-------|--------------------------------|---------------------|----------|--------------------|
| 0     | **Current pilot (you only)**   | 1 clinician         | Done     | None — no PID      |
| 1     | **Local pilot**                | 1 dept, 2-3 clinicians, no patient form | 4-8 weeks | DPIA-lite, CSO informed |
| 2     | **Patient form pilot**         | 1 dept, ~50 patients, NHS Login auth    | 12 weeks | DPIA, DCB0129/0160, IG sign-off |
| 3     | **EPR write-back pilot**       | 1 dept, full integration                | 12 weeks | Full pack |
| 4     | **Trust-wide colorectal**      | All GEH colorectal 2WW clinics          | Rolling  | Same |
| 5     | **Replicate to other 2WW**     | Lung, UGI, urology, etc.                | Per-dept | New DCB packs per |

---

## 14. Open questions for the Trust

These need answers before Phase 2:

1. **Identity for clinicians** — Smartcard, NHSmail, or both?
2. **Which FHIR endpoint** does GEH expose (PAS / Lab / EPR vendor)?
3. **Cloud hosting approval** — does GEH have an existing AWS UK landing
   zone, or do we provision via the Trust IT cloud team?
4. **CSO assignment** — supplier-side and Trust-side?
5. **Caldicott** — happy with pseudonymised model (NHS Login OAuth subject +
   encounter ID, no raw NHS number stored)?
6. **Audit retention** — Trust standard (typically 7 years for clinical
   records)?
7. **Algorithm change cadence** — quarterly MDT review?

---

## 15. Out of scope (explicit)

- Full electronic medical device (Class IIa) pathway — current scope is
  Class I decision support
- Machine learning / LLM-based decisions — engine is a deterministic
  encoding of MDT-approved Trust algorithm
- Cross-Trust data sharing — design is single-Trust
- Patient-facing chat or messaging — submit-only form
- Non-2WW colorectal pathways — scope ends at 2WW intake decision

---

## 16. Migration from current pilot

The pilot's algorithm engine, tests, schema and UI components all carry
forward unchanged. What changes:

- Same `src/algorithm/` and `src/schema/` move into a shared package
- Frontend gains a server-backed mode (auth, fetch from API)
- Backend wraps the same engine in API endpoints
- Audit/storage added; everything else is additive

This means the pilot is genuinely the v0 of the production tool, not a
prototype to be thrown away — the algorithm encoding effort and test
suite are kept.
