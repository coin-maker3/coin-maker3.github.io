# 2WW Colorectal Pathway Audit — Project Log

**Project:** Concordance audit of an algorithmic decision-support tool for the George Eliot Hospital 2-week-wait lower-GI pathway
**Lead:** Mr Kasun Wanigasooriya · **Project team:** Ali Mohamed Elhassan, Lucy-Ann O'Kane, Temitope Ken-Afolabi, Sharanya Arun, Olivia Jackson
**Tool:** https://ww-colerectal.web.app/audit/new · **Data:** Teams → 2WW LGI Pathway → "AI 2WW Project" → `2WW-Colorectal-Audit.xlsx`

This log records what has been built and decided, in order, so the team and the audit department can see exactly what was done and when.

---

## May–June 2026 — Algorithm and tool development
- Triage algorithm written for the 2WW lower-GI pathway (current version **GEH-2WW-COLORECTAL v0.4.0**), encoding the referral criteria and investigation recommendations as explicit, testable rules.
- Algorithm covered by **95 automated unit tests**, all passing — every rule change re-runs the full test set before deployment.
- Web tool built around the algorithm (case details in → recommendation out) for use alongside normal clinical judgement; the algorithm never replaces the clinician's decision.

## 29 June 2026 — Hosting, safety controls, and audit design
- Tool moved to **Firebase Hosting, UK (London) region**, owned and administered by the project.
- **Patient-facing referral upload pathway disabled** at Mr Wanigasooriya's request — the tool is clinician-use only. The patient form now displays "not in use" and the server rejects any such submission.
- **Structured discordance capture designed** (approved by Mr Wanigasooriya): where the clinician's decision differs from the algorithm's recommendation, the reviewer records a reason (algorithm error / clinician deviation / transcription difference / clinically equivalent / other) and a direction — with clinician-recommended-less-than-algorithm flagged as potential under-investigation, the key safety signal.
- First draft of the **GEH Clinical Audit Proposal Form** completed.

## 1 July 2026 — Data governance decision and go-live
- **Information-governance review of the data flow.** Decision: the tool holds and transmits **no patient data at all**. It is a stateless calculator — the clinician enters a case, reads the recommendation, and copies a single spreadsheet row.
- All audit data lives in **one controlled-access Excel workbook inside the department's own Microsoft Teams** (South Warwickshire NHS tenant) — the same in-tenant model already used for the department's M&M sheet and handover patient lists. MRN is permitted as case identifier because the data never leaves the Trust tenant.
- An automated one-click submission flow (Power Automate) was assessed and **rejected**: any automated flow of patient-identifiable data would require IG assessment/DPIA; manual copy-paste into the Teams workbook keeps the tool at zero data transmission.
- **Final-diagnosis field added** to the tool and workbook (colorectal cancer / other cancer / benign / not known) so cancer outcomes can be analysed against the algorithm's recommendations.
- **Audit workbook built and uploaded to the Teams channel:** 38 columns matching the tool's copy-row exactly; a Guide sheet; and a Summary sheet with live formulas — overall concordance %, cancer counts, and a highlighted **safety measure: cancers where the algorithm's recommendation would have meant less investigation than the clinician performed**.
- **Teams channel "AI 2WW Project" set up** inside the 2WW LGI Pathway team, with the tool link and workbook pinned.
- **Tool verified live**: a test case marks correctly; the copied row matches the workbook's 38 columns; empty submissions are rejected.
- Proposal form updated to reflect the local-Teams data-handling model and the cancer-outcome/safety aims — ready for clinical.audit@geh.nhs.uk.

## 15 July 2026 — Project re-activated; Kasun's requested documents delivered
- **Build Record written** (`docs/BUILD-RECORD.md` + Word copy `docs/2WW-Build-Record.docx`) — the full chronological record of how the tool was designed, built, verified and governed, requested by Mr Wanigasooriya; language aligned with the Technical Factsheet so it doubles as AI-Committee evidence if requested.
- **Paper Results/Outcome-findings section drafted** (`docs/PAPER-RESULTS-SECTION.md`) — publication-register skeleton where every placeholder maps to a Summary-sheet cell: cohort, primary concordance (Wilson CI, Cohen's kappa), per-arm table, structured discordance analysis, the cancer-outcome safety measure, pre-specified subgroups, stop criteria, plus Discussion notes.
- **Two worked example rows generated** (`worked-example-rows.tsv`, worktree root) — produced through the real v0.4.0 engine, 38 columns verified against the workbook layout: TEST-EX-01 (concordant, colon capsule) and TEST-EX-02 (discordant, colonoscopy vs colonoscopy+OGD, demonstrating the under-investigation safety flag). Marked as examples; to be pasted on the Guide sheet, not the data sheet.
- Live tool health-checked: https://ww-colerectal.web.app returns 200, audit page serving.

## 15 July 2026 — "Not documented in the letter" tick-boxes (reviewer feedback, annotation-only)
- Reviewers reported some questions have no answer in the clinic letter and suggested an "N/A" option. Methodology decision (Mr Wanigasooriya asked the same question): **N/A must not become an input to the calculator** — the algorithm keeps receiving definite answers, and "not mentioned = No" remains the stated convention, so every case entered so far stays consistent and the audit remains a validation of the calculator.
- Instead, an **annotation-only** panel was added to the entry page: 14 tick-boxes ("Not documented in the letter") covering the symptom/history items. Ticking them **never changes the recommendation**; they write machine-countable text into the existing Notes column ("Not documented in letter: Tenesmus, Mucus PR"), so letter-documentation quality can be analysed later as a secondary finding. Row stays 38 columns — existing workbook unaffected.
- Reviewer rule on mismatches reiterated: if the clinician likely acted on information not in the letter, classify the discordance as clinician deviation / data difference — never algorithm error.
- Verified before deploy: 95/95 unit tests, build green, end-to-end browser test (row = 38 columns, ND text in Notes, recommendation unchanged — Colonoscopy + OGD for the reference IDA case). Algorithm version unchanged (v0.4.0). Deployed hosting-only; live-verified. No server/function change.

## 16 July 2026 — N/A decision finalised: REVERTED to the original form
- After team discussion, the decision (Ali, with methodology advice): **no N/A of any kind in the tool** — the stated convention "not mentioned in the letter = No" is the single rule, matching how all cases have been entered since go-live. The 15 Jul annotation-only tick-box panel was removed and the entry page restored to the exact original design; deployed and live-verified (95/95 tests, algorithm v0.4.0 unchanged, discordance capture intact).
- Rows entered while the panel was briefly live remain fully valid (any tick output was plain text in the Notes column; no schema change existed).
- The policy lives in the reviewer guidance instead: enter No when the letter is silent (add a free-text note if desired); on a mismatch where the clinician likely acted on undocumented information, classify as clinician deviation / data difference — never algorithm error.

## 16 July 2026 — Form 3 LIVE (approved by Mr Wanigasooriya): "Not documented" + full structured capture
- Mr Wanigasooriya reviewed the preview link and approved. Deployed to ww-colerectal.web.app same day.
- Every yes/no question now offers Yes / No / **Not documented** (amber), defaulting to Not documented — the truthful state before the letter is read. ND computes as "No" (the standard case-note convention, declared on-screen beside the recommendation) so the algorithm (v0.4.0, 95 tests) is unchanged and all rows remain comparable.
- **Full structured capture**: the copied row grew from 38 to 66 columns (original 38 untouched, 28 appended) — clinic type, prior bloods, bloods-within-3-months, FIT done/not done/ND, bleeding source, DRE-documented-in-referral, abnormal CT, prior surgery, fitness/consent items, decision-maker grade (grade only, never names), time per case, free-text scan-hit categories, and an "END <date>" paste-check cell. Free text from letters is never copied (no PID surface).
- **Paste procedure fixed** after a reviewer lost 4 hours to misaligned pasting: on-screen 4-step instructions (desktop Excel, single-click the Case ID cell, Ctrl+V, verify the last cell reads END + date).
- **Workbook v2 template built** (66 colour-coded columns, Guide, live Summary incl. documentation-quality and workload blocks) — data migration done by the audit team inside the Trust tenant only.
- Planned analyses widened accordingly: documentation-quality secondary outcome + sensitivity analysis (concordance in ND-containing vs fully-documented cases); audit registration amendment to follow.

## Current status (2 July 2026)
- **LIVE and collecting.** Team members enter 2WW cases via the tool and paste rows into the workbook; final diagnoses are completed as outcomes become known (the channel's existing `Suspected_Diagnosed_Cancer_Report.xlsx` may serve as the outcome source — to be confirmed).
- Nothing about the pathway itself has changed: the audit measures concordance retrospectively; clinical decisions remain entirely with the clinicians.

## Next steps
1. Case entry by the project team (target dataset size per proposal form).
2. Final-diagnosis column completed as outcomes mature.
3. Interim review of the Summary sheet (concordance % and the safety measure) with Mr Wanigasooriya.
4. Findings written up for presentation / publication.

---
*This log is maintained by Ali Mohamed Elhassan (with AI-assisted development tooling). Last updated 2 July 2026.*
