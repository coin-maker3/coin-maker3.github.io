# 2WW Colorectal Triage Tool — Algorithm Overview

**For:** Mr Kasun and the colorectal team
**Source of truth:** `LATEST_2WW_INVESTIGATIONS__ALGORITHM_4.pdf` (Trust 2WW investigation algorithm)
**Encoded version:** `GEH-2WW-COLORECTAL v0.2.1`
**Test coverage:** 42 unit tests, all passing (one per branch + edge cases)

The tool encodes the Trust 2WW colorectal investigation algorithm as a deterministic decision tree. Every recommendation:

- carries a **node ID** traceable to the PDF (e.g. `IDA.col_ogd` = the IDA branch, fit-for-prep leaf → Colonoscopy + OGD)
- records the **full traversal** from root to leaf, with the data point that drove each branch
- stamps the **algorithm version** so any future change is detectable in the audit dataset

---

## Order of evaluation (priority top-to-bottom)

```
1. ROUTING EXCEPTIONS  ──>  Lacks capacity + telephone → book F2F clinic
                        └>  Recent colonoscopy <2y     → discuss with COW

2. IDA branch          ──>  Low Hb + (low MCV or ferritin <30)
                            takes priority over symptom-driven branches.
                            Investigates upper + lower GI.

3. Mass branch         ──>  Palpable abdominal or rectal mass on examination.
                            Rectal mass takes precedence; low+tender → COW for EUA.

4. Weight loss         ──>  Significant unintentional weight loss
                            (only if no concurrent CIBH/bleeding/FIT+ — those route
                            through their own branches with higher information).

5. CIBH / Rectal bleeding (FIT-driven)
                       ──>  Change in bowel habit, PR bleed, tenesmus, mucus PR,
                            or referred for either of the above.

6. Asymptomatic FIT+   ──>  Truly asymptomatic but FIT positive.

7. No criteria         ──>  Doesn't meet any of the above. Discharge to GP.
```

---

## Branch 1: IDA (Iron Deficiency Anaemia)

**Definition (from PDF):** low Hb + (low MCV OR ferritin <30 µg/L).
**Hb cut-offs:** Hb <130 g/L male, <120 g/L female (NICE / BSG).
**MCV cut-off:** <80 fL.
**Ferritin cut-off:** <30 µg/L.

**Why this branch takes priority:** IDA needs both upper and lower GI investigation regardless of original referral reason. A GP-referred CIBH patient who is also IDA → IDA pathway, not CIBH pathway.

| Leaf | When | Recommendation |
|---|---|---|
| `IDA.ct_tap` | Age ≥90, OR (not fit for prep AND poor mobility) | **CT TAP.** No CT chest in first instance per PDF footnote. |
| `IDA.ctc_ogd` | Age ≥80, OR not fit for full prep, OR poor mobility | **CTVC (limited prep) + OGD.** |
| `IDA.col_ogd` | Fit for bowel prep | **Colonoscopy + OGD.** |

**Engine warnings emitted:**
- No ferritin recorded → "chase before requesting scope" (Trust footnote)
- IDA on Hb alone (no MCV, no ferritin) → "IDA referrals must have ferritin"
- IDA overrides original referral reason → path notes "GP referred for X — IDA upgraded"

---

## Branch 2: Palpable mass on examination

Requires F2F clinic. Engine warns if mass identified in telephone clinic — bring patient in.

### Rectal mass (priority over abdominal)

| Leaf | When | Recommendation |
|---|---|---|
| `MASS.rectal.low_tender` | Rectal mass + low + tender | **Discuss with COW** re EUA before scoping. |
| `MASS.rectal.unfit_prep` | Rectal mass + not fit for prep | **Flexible sigmoidoscopy with enema +/- CT TAP.** |
| `MASS.rectal.standard` | Rectal mass, otherwise fit | **Colonoscopy** (+/- CT TAP and MRI rectum if obvious cancer). |

### Abdominal mass

| Leaf | When | Recommendation |
|---|---|---|
| `MASS.abdo.ct_ap` | Age ≥90 OR poor mobility | **CT AP.** Not for CT chest in first instance. |
| `MASS.abdo.ctvc` | Otherwise | **CTVC** (limited prep if not fit for full prep). |

---

## Branch 3: Significant unintentional weight loss

Triggers only if patient has no concurrent CIBH/bleeding/FIT+ (those carry more information).

| Leaf | When | Recommendation |
|---|---|---|
| `WTLOSS.no_risk_fit_neg` | FIT negative, no risk factors, otherwise asymptomatic | **Discharge to GP** with letter — re-refer to non-specific symptoms pathway. |
| `WTLOSS.elderly` / `WTLOSS.elderly_ogd` | Age ≥80 OR not fit for full prep | **CT AP** (or **CT AP + OGD** if loss >3 kg per Trust footnote). |
| `WTLOSS.standard` / `WTLOSS.standard_ogd` | Otherwise | **CTVC** (or **CTVC + OGD** if loss >3 kg). |

Engine warns if previous CRC + weight loss → consider CT chest for metastases.

---

## Branch 4: CIBH / Rectal Bleeding (FIT-driven)

Triggered by: CIBH yes, any PR bleed, tenesmus, mucus PR, or referred for CIBH/rectal bleeding.

### Sub-branch: FIT positive (≥10 µg Hb/g) OR no FIT supplied (treated as positive)

| Leaf | When | Recommendation |
|---|---|---|
| `CIBH.fit_pos.ct_ap` | Age ≥90 OR (not fit for prep AND poor mobility) | **CT AP.** |
| `CIBH.fit_pos.ctc` | Age ≥80 OR not fit for full prep OR poor mobility | **CTVC** (+/- FOS if tenesmus or PR mass). |
| `CIBH.fit_pos.colonoscopy` | Otherwise | **Colonoscopy.** |

### Sub-branch: FIT negative (<10)

Engine first checks for **risk factors** (anaemia not meeting IDA criteria, FHx CRC/IBD, previous CRC, IBD). If present → treat as FIT positive (above table).

If no risk factors:

| Leaf | When | Recommendation |
|---|---|---|
| `CIBH.fit_neg.no_risk.ctc` | Age ≥80 OR not fit for prep OR WHO ≥2 | **CTVC** (capsule alternative). |
| `CIBH.fit_neg.no_risk.capsule` | Otherwise | **Colon capsule endoscopy** (downgrade to urgent). |

---

## Branch 5: Asymptomatic FIT positive

Patient genuinely asymptomatic, referred for FIT+.

| Leaf | When | Recommendation |
|---|---|---|
| Risk factors present | Anaemia / FHx CRC / previous CRC / IBD | → falls through to CIBH FIT+ table (above) |
| FIT ≥50 µg Hb/g | High-FIT asymptomatic | → falls through to CIBH FIT+ table (above) |
| `ASYMPT.fit_low.ctc` | FIT <50, no risk factors, age ≥80 / prep concerns / WHO ≥2 | **CTVC.** |
| `ASYMPT.fit_low.capsule` | FIT <50, no risk factors, otherwise fit | **Colon capsule endoscopy** (downgrade to urgent). |

---

## Branch 6: No criteria met

`ROUTE.NO_CRITERIA` → **Discharge to GP** with letter documenting findings, ask GP to send FIT and re-refer if positive.

---

## Routing exceptions (evaluated first)

| Node | Trigger | Recommendation |
|---|---|---|
| `ROUTE.LACKS_CAPACITY` | `lacksCapacity=yes` AND `clinicType=telephone` | **Book F2F clinic appointment.** |
| `ROUTE.RECENT_INV` | Colonoscopy or CTVC in last 2 years | **Discuss with COW** before repeat investigation. |

---

## Audit-fix history (v0.2.0 → v0.2.1)

Six corrections identified during pre-pilot review:

1. IDA + poor mobility → was misrouted to Colonoscopy + OGD; now correctly routes to CTVC + OGD.
2. CIBH FIT+ + poor mobility → same fix.
3. Tenesmus alone now triggers CIBH branch.
4. Mucus PR alone now triggers CIBH branch.
5. Weight loss + elderly + >3 kg → now CT AP + OGD (was CTVC + OGD).
6. `lacksCapacity` + telephone clinic → `book_f2f_clinic` routing added.

---

## Known limitations (candidate refinements for the audit to confirm)

The audit may reveal that some clinician decisions deviate from the algorithm in systematic ways. Anticipated candidates for v0.3+:

1. **Prior bowel surgery is not currently a structured input.** A patient with prior subtotal colectomy + FIT+ should not get colonoscopy (no colon to scope). Currently the surgical history field is free text and the engine doesn't read it. **The audit will likely surface this as a recurring mismatch.**
2. **Abnormal-CT branch** (right side of PDF page 1) is not yet encoded — low clinical volume, deferred until the audit catches a need.
3. **No structured "patient preference / declined investigation"** input — clinician overrides for patient choice currently captured in free-text reviewer notes.
4. **No structured comorbidity score** beyond WHO and ADL independence — Clinical Frailty Scale exists in the schema but is not yet used by the engine.

---

## How to interrogate a specific case

Open `/audit` on the live tool and click the **▶** next to any case ID. The expanded row shows:

- The exact path the algorithm traversed (each branch + the data point that drove it)
- The rationale string explaining the leaf
- Any engine warnings raised
- The algorithm version stamp
- The actual clinical decision and any outcome / reviewer notes

This is the source of "how we reached this recommendation" for any specific patient in the audit.
