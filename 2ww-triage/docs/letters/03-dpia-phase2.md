# Data Protection Impact Assessment — Phase 2 (Patient Form Pilot)

> Template aligned with **ICO DPIA guidance** and the **NHS DSPT** framework.
> Pre-filled with the project's known answers. Sections marked **[Trust DPO]**
> or **[Caldicott]** are for completion by the Trust during review.

---

## 1. Project information

| Field                                  | Value                                              |
|----------------------------------------|----------------------------------------------------|
| Project name                           | 2WW Colorectal Triage Aid                          |
| Phase                                  | Phase 2 — patient form pilot                       |
| Department                             | Colorectal Surgery, George Eliot Hospital          |
| Information Asset Owner                | [Trust IAO — typically clinical director]          |
| Senior Information Risk Owner          | [Trust SIRO]                                       |
| Data Protection Officer                | [Trust DPO]                                        |
| Caldicott Guardian                     | [Trust Caldicott Guardian]                         |
| Clinical Safety Officer (supplier-side)| [TBA]                                              |
| Clinical Safety Officer (Trust-side)   | [TBA]                                              |
| DPIA author                            | [Your name], colorectal lead clinician             |
| Submission date                        | [Date]                                             |
| Review cadence                         | Annual + on material change                        |

---

## 2. Description of the processing

### 2.1 Purpose

To enable a patient referred under the 2-week-wait colorectal pathway to
submit a structured pre-clinic symptom questionnaire ahead of their
clinic appointment. The questionnaire is reviewed and validated by the
clinician at the clinic appointment and used to support an algorithm-
generated investigation recommendation.

### 2.2 Lawful basis for processing

- **GDPR Article 6(1)(e)** — public task (provision of NHS care)
- **GDPR Article 9(2)(h)** — health and social care (special category data)
- **DPA 2018 Schedule 1 Part 1 paragraph 2** — health or social care
  purposes

Patient consent is **not** the lawful basis (avoids the trap of consent
withdrawal mid-pathway). Patients are informed via a privacy notice and
can opt out (in which case they are seen by the clinician who collects
information as usual, with no change to pathway).

### 2.3 Data flows

**Inbound (patient → Trust):**

| Item                              | Identifiable? | Stored where                                                                                                |
|-----------------------------------|---------------|-------------------------------------------------------------------------------------------------------------|
| NHS Login OAuth subject identifier| Pseudonymised | Encrypted RDS Postgres (`encounter.patient_nhs_login_subject`)                                              |
| Appointment ID (from PAS)         | Indirect      | Encrypted RDS Postgres (`encounter.trust_encounter_id`)                                                     |
| NHS number                        | Identifiable  | **Stored only as SHA-256 hash with per-Trust pepper** for cross-system join; raw value never persisted     |
| Symptom answers (Q1–Q15)          | Health data   | Encrypted RDS Postgres (`intake_patient.payload` JSONB)                                                     |
| Timestamps, user agent (audit)    | Indirect      | Append-only audit log                                                                                       |

**Inbound (Trust systems → app):**

| Item                              | Source                       | Notes                                            |
|-----------------------------------|------------------------------|--------------------------------------------------|
| Bloods (Hb, MCV, ferritin, etc.)  | Trust Lab (FHIR Observation) | Read-only; displayed to clinician, not stored beyond decision  |
| Prior investigations              | Trust EPR (FHIR Procedure)   | Read-only; displayed to clinician                |
| Appointment metadata              | Trust PAS (FHIR Appointment) | Read-only                                        |

**Outbound (app → Trust EPR):**

| Item                              | Destination                  | Format                                           |
|-----------------------------------|------------------------------|--------------------------------------------------|
| Clinic letter (validated)         | Trust EPR `DocumentReference`| FHIR R4                                          |
| Encounter outcome code            | Trust EPR encounter outcome  | SNOMED CT                                        |

**No data flows outside the Trust governance perimeter.** No third-party
analytics, no offshore processing, no AI/ML training data extraction.

### 2.4 Data categories

| Category                          | Examples                                          | Notes                            |
|-----------------------------------|---------------------------------------------------|----------------------------------|
| Special category (health)         | Symptoms, bloods, prior investigations            | Lawful basis: Art 9(2)(h)        |
| Identifiers (pseudonymised)       | NHS Login subject ID, encounter ID, NHS number hash | Re-identifiable only within Trust|
| Workflow metadata                 | Timestamps, audit log, clinician ID               |                                  |
| **NOT collected**                 | Free-text identifiers, name, DOB, address, phone  | Patient form has no such fields  |

### 2.5 Volume and retention

- **Volume:** ~10-15 patients per 2WW colorectal clinic, 2 clinics/week
  during pilot ≈ 1500 patients/year per consultant.
- **Retention:** Clinical decisions are part of the medical record (Trust
  retention applies — typically 8 years from last attendance under NHS
  Records Management Code of Practice). Pseudonymised audit log retained
  for 7 years.
- **Deletion:** Patient right-to-erasure honoured for non-clinical-record
  data (audit logs sanitised; clinical letters remain as part of the
  medical record under medical record retention rules).

### 2.6 Recipients

| Recipient                         | Why                                | Lawful basis                          |
|-----------------------------------|------------------------------------|---------------------------------------|
| Clinician seeing the patient      | Direct care                        | Art 6(1)(e), Art 9(2)(h)              |
| Trust CSO (audit dashboard)       | Clinical safety review             | Art 9(2)(h)                           |
| Trust IAO / IG / DPO              | Information governance oversight   | Art 6(1)(c) — legal obligation        |
| Trust MDT (aggregate MI)          | Pathway quality improvement        | Art 9(2)(h)                           |

---

## 3. Necessity and proportionality

| Question                                                                | Answer                                                                                                                                                          |
|-------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Could the processing be avoided?                                        | No — the clinician already collects this data verbally. The patient-supplied form moves the collection earlier and structures it.                              |
| Could less data achieve the purpose?                                    | The 15 patient questions are the minimum subset of the existing Trust 2WW clinic form needed to drive the algorithm. Bloods/exam/fitness remain clinician-entered. |
| Is processing limited to what is necessary?                             | Yes. No name, DOB, contact details, free-text identifiers, geolocation, or device fingerprint.                                                                  |
| Are individuals informed?                                               | Yes — privacy notice on the patient form landing page, signed off by Trust DPO.                                                                                 |
| Can individuals exercise their rights?                                  | Yes — access, rectification, restriction, objection, complaint all routed via Trust DPO via standard channels. Erasure subject to medical record retention rules. |
| Is there an existing alternative that wouldn't trigger this DPIA?       | Current state (clinician collects verbally in clinic). DPIA exists because the new processing route (patient self-submission) is new.                            |

---

## 4. Identifying privacy risks

| Risk ID | Risk                                                                  | Likelihood | Impact | Severity |
|---------|------------------------------------------------------------------------|------------|--------|----------|
| R-01    | Patient symptom data leaked via misconfigured cloud storage           | Low        | High   | Medium   |
| R-02    | Patient impersonation (someone else submits answers under NHS Login)  | Low        | Medium | Low      |
| R-03    | Patient identity mismatch (right NHS Login, wrong appointment)        | Low        | High   | Medium   |
| R-04    | Clinician device compromise during validation                          | Low        | High   | Medium   |
| R-05    | Audit log compromise (insider misuse)                                  | Low        | Medium | Low      |
| R-06    | Patient lacks digital access / capacity → exclusion                    | Medium     | Medium | Medium   |
| R-07    | Mistaken belief that the tool stores no data (it does, server-side)    | Medium     | Low    | Low      |
| R-08    | Loss of cloud provider availability mid-clinic                         | Low        | Low    | Low      |
| R-09    | Patient browser plugin (e.g. translation) altering submitted data      | Low        | Low    | Low      |
| R-10    | Insufficient transparency around algorithm decisions                   | Low        | Medium | Low      |

---

## 5. Measures to reduce risk

| Risk    | Mitigation                                                                                                                                                  |
|---------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| R-01    | AWS UK eu-west-2 only; VPC-private DB; KMS encryption at rest; TLS 1.3 in transit; CHECK-approved pen test before go-live and annually                       |
| R-02    | NHS Login is the patient identity provider (NHS verified to P5 or P9). Encounter ID binds NHS Login subject to PAS appointment.                              |
| R-03    | Clinician validates identity at clinic appointment (existing practice). Triage screen displays appointment context for visual cross-check.                  |
| R-04    | Trust-managed devices only on `/clinician/*` route. HSCN-only ingress. Smartcard or NHSmail MFA. Session timeout 15 minutes.                                  |
| R-05    | Audit log is append-only, write-once. Shipped to Trust SIEM. Per-action authorisation; CSO/IAO dashboard separated from clinician role.                       |
| R-06    | Patient form is optional. Patients without digital access are seen as today; clinic reception offers kiosk-mode tablet on arrival; nurse-assisted entry permitted. |
| R-07    | Privacy notice explicit that data is stored on Trust-controlled cloud during the pathway. Patient can review submitted answers in clinic.                     |
| R-08    | App degrades gracefully — if backend unreachable, falls back to local-only entry (the Phase 0 mode). Clinic continues.                                         |
| R-09    | Server-side validation of all inputs. Schema enforcement (Zod). Clinician validates content in clinic.                                                       |
| R-10    | Algorithm path and node ID shown to clinician; rationale included in clinic letter; full encoding open-source within Trust.                                  |

---

## 6. Consultation

| Stakeholder                       | Status                                |
|-----------------------------------|---------------------------------------|
| Colorectal MDT                    | [To be consulted]                     |
| Lead nurse, colorectal            | [To be consulted]                     |
| Trust DPO                         | [DPIA review owner]                   |
| Caldicott Guardian                | [Caldicott sign-off]                  |
| Trust IG team                     | [To review]                           |
| Trust CSO                         | [Joint review with DCB0160]           |
| Patient and public involvement panel | [To be consulted before Phase 2]  |

---

## 7. Sign-off

| Role                              | Name                             | Decision           | Date     |
|-----------------------------------|----------------------------------|--------------------|----------|
| DPIA author                       | [Your name]                      | Submitted          | [Date]   |
| Data Protection Officer           | [Trust DPO]                      | [Approved/Conditions/Rejected] |          |
| Caldicott Guardian                | [Trust Caldicott Guardian]       | [Approved/Conditions/Rejected] |          |
| Senior Information Risk Owner     | [Trust SIRO]                     | [Approved/Conditions/Rejected] |          |
| Information Asset Owner           | [Trust IAO]                      | [Approved/Conditions/Rejected] |          |

---

## 8. Residual risk statement

After mitigations, the residual privacy risks for the Phase 2 pilot are
**Low**, on the basis of:

- No collection of free-text identifiers
- NHS Login as the identity layer (NHS-verified, not project-managed)
- All data stored in Trust-controlled AWS UK with KMS encryption
- No data flow outside the Trust governance perimeter
- All clinician access logged and auditable
- Patient form is optional; non-digital patients are unaffected

The IAO is recommended to approve the pilot subject to:

1. Privacy notice signed off by DPO
2. CHECK pen test completed
3. CSO sign-off (DCB0129 + DCB0160)
4. Quarterly review during pilot

---

**End of DPIA template.**
