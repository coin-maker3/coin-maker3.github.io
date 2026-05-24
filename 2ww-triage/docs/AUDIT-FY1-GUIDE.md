# FY1 Guide — 2WW Colorectal Concordance Audit

Welcome. Thank you for helping. Once you're warmed up, expect ~3–5 minutes per case (much faster for excluded ones). Aim for **25 cases per session**.

---

## How the data flows (read this once)

```
1. Audit lead (Mr Ali) pulls the 2WW patient list from the Trust system.
   That spreadsheet contains patient name / NHS no / DOB / MRN.
   It stays on Trust kit. You never see it.

2. You receive a SLIM lookup sheet from Mr Ali, just two columns:
       audit_id    MRN
       GEH-2WW-001 M12345
       GEH-2WW-002 M67890
       ...
   This lookup sheet is the ONLY PID-touching document you hold, and
   only for the duration of your audit session.

3. For each row of YOUR lookup sheet:
       a. Open the MRN in the Trust clinical portal (EPR)
       b. Read the 2WW colorectal clinic letter for that visit
       c. Open the audit tool (URL below)
       d. Enter the structured findings — under the audit_id
       e. Move to next row

4. End of session — return / delete the lookup sheet.
   Never save it on a personal device. Never email it externally.
```

The audit tool stores anonymous data only. Your audit IDs (e.g. `GEH-2WW-001`) flow into the tool; names / NHS numbers / MRNs / DOBs **do not**.

---

## The tool

**https://geh-2ww-colorectal.vercel.app/audit/new**

When you open it, the **Audit ID** field is pre-filled with the next pending ID from the cohort Mr Ali set up. Confirm it matches the row you're working on in your lookup sheet. If not, type the correct one.

### Other top-of-form fields

- **Entered by (initials)** — your initials, e.g. `AB` (2–4 chars).
- **Clinic month** — month and year of the clinic visit (no specific day).

---

## Two paths per case

### Path A — case is excludable (DNA, direct-to-MDT, withdrew, duplicate)

If the clinic letter shows any of these:
- **Did not attend** (no clinic outcome)
- **Discharged before assessment** (e.g. duplicate referral, withdrew consent)
- **Obvious cancer referred straight to MDT** (no investigation pathway choice was applied)
- **Duplicate referral** for the same patient
- **Withdrew consent / refused investigation**

Then:
1. Tick the box **"Exclude this case from the concordance analysis"** at the top of the form
2. Choose the reason from the dropdown
3. Add any one-line note (optional, anonymised)
4. Click **Save audit case** — done. No further data entry needed.

The case is recorded so the audit's denominator is transparent in the final report, but it does not affect the concordance percentage.

### Path B — eligible case (the normal flow)

1. Read the clinic letter top-to-bottom. **The form is laid out in the same order as the GEH 2WW proforma**, so go line by line:
   - Reason for referral
   - Patient details + most recent blood tests (FIT, age, gender, WHO, Hb / Ferritin / MCV / GFR)
   - Past medical, surgical & drug history (and prior bowel-surgery dropdown if relevant)
   - Symptoms (bowel habit, rectal bleeding + visible source if any, mucus, tenesmus, weight loss, abdo pain)
   - Family history + previous abdominal disease
   - Recent investigations + abnormal CT findings (if any)
   - Social
   - Procedure fitness
   - Examination findings (and palpable mass yes/no flags)
   - Consent
2. As you type, the right-hand **Algorithm decision card** updates live. Don't peek-and-tweak — just enter what the letter says.
3. Once data entry is done, scroll to **"Audit — actual clinical outcome"** and pick what the clinic actually decided.
4. The tool auto-flags **Concordant** (match) or **Mismatch**.
5. **If mismatch**: write one sentence on why the clinician may have chosen differently (patient preference, comorbidity, MDT decision, gut feeling). This is the most valuable data you provide.
6. **Click Save audit case**.

---

## What you must NEVER enter into the tool

- ❌ Patient name (including initials of the patient)
- ❌ NHS number
- ❌ Hospital / MRN number
- ❌ Date of birth (use age in years instead — letter will state it, or compute from DOB)
- ❌ Specific clinic date (month and year only)
- ❌ Free-text identifiers (postcodes, addresses, phone, email)

The tool has no field for these. If you find yourself wanting to type one of these somewhere, stop — the audit doesn't need it. The tool also **scans your free-text fields** (PMH, surgical history, exam findings, notes) and will flash an amber warning if it spots NHS-number / DOB-shape text. Don't override that warning — fix the entry.

The MRN belongs in your lookup sheet, not in the tool.

---

## Quick reference — common edge cases

| In the clinic letter | What you do |
|---|---|
| Patient DNA, no outcome documented | Path A — Exclude, reason "Did not attend" |
| Discharged at booking before assessment | Path A — Exclude, "Discharged before assessment" |
| Obvious cancer at referral → straight to MDT | Path A — Exclude, "Obvious cancer — direct to MDT" |
| Duplicate referral for the same patient | Path A — Exclude, "Duplicate referral" |
| Bloods missing in letter | Leave blank — tool handles missing values |
| FIT not done / not in letter | Leave blank — tool treats as "no FIT" per Trust algorithm |
| Multiple investigations decided (e.g. col + CT TAP) | Pick the **primary** one in "Actual decision"; note the additional in outcome notes |
| Outcome is "discuss at MDT" | Choose **Discuss at colorectal MDT** |
| Outcome is "discharge to GP" | Choose **Discharge to GP with advice** |
| Outcome is "discuss with Consultant of the Week" | Choose **Discuss with Consultant of the Week** |
| Letter says "haemorrhoids" / "fissure" on DRE | Tick the **Visible source of bleeding on examination** dropdown — the tool flags whether this might justify downgrading |
| Letter says "previous subtotal colectomy" / "APR" / "pouch" | Tick the **Prior bowel surgery** dropdown — the tool flags whether the recommendation is anatomically appropriate |
| Letter mentions colonoscopy or CTVC in the last 2 years | Tick the matching **"in last 2 years"** toggle — this triggers the routing exception → discuss with COW |
| Letter says abnormal CT showing colonic / rectal thickening | Tick the **Abnormal CT findings** dropdown — separate Trust algorithm pathway |
| You're not sure what the actual decision was | Skip the case; flag the row in your lookup sheet for Mr Ali |
| You entered a case by mistake | Use **Delete** on the case row in the `/audit` dashboard |

---

## Tips

- **One letter at a time.** Don't multitask. Don't have multiple EPR tabs open.
- **Type fast.** The tool measures time per case — that's a planned secondary outcome. Don't agonise over interpretation; if a finding is documented, enter it; if not, leave it blank.
- **Don't second-guess the algorithm.** Just enter what's in the letter. The algorithm's recommendation appears once you've finished the symptom + exam + fitness fields.
- **Trust your reading.** If the letter says "tenesmus", click yes. If it says "no tenesmus", click no. If it's not mentioned, don't infer — leave it.
- **Mismatch ≠ error.** Many mismatches are legitimate clinician overrides — patient preference, comorbidity, MDT decision. Those are exactly what we want to learn from. Capture the *why* in one sentence.

---

## End-of-session checklist

- [ ] Hit **Save** on the current case before closing the tab
- [ ] Open `/audit` dashboard — confirm your cases show in the table with your initials
- [ ] Cohort progress bar reflects what you entered
- [ ] Hand back your lookup sheet to Mr Ali (or shred it if you have your own copy)
- [ ] Do **not** save the lookup sheet on a personal device
- [ ] Stop at the end of your agreed window

---

## Stuck?

WhatsApp the audit lead. Don't enter cases when you're unsure — flag the row in your lookup sheet and move on. We'd rather have 90 confident cases than 100 with guesswork.

---

## Privacy reminder

You are accessing real clinic letters as part of your normal clinical duty. The audit tool you're typing into has been designed so that no identifiable information enters it — only structured clinical findings tagged with anonymous audit IDs. The audit dataset is fully anonymous and will be shared with the Trust audit office on completion.

The only document holding the patient identifiers + audit IDs is the lookup sheet from Mr Ali, which is destroyed when the audit closes.
