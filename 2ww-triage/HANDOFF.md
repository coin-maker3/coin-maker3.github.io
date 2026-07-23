# 2WW Colorectal Audit — Session Handoff (2026-07-01)

## State: LIVE, collecting data. Mr Kasun has green-lit.

**Tool (ww-colerectal.web.app/audit/new)** — now a STATELESS CALCULATOR. All cloud storage removed (AuditNewPage.tsx rewritten). Flow: enter case → tool shows algorithm recommendation → **"Copy row for the audit sheet"** (38-col TSV) → paste into the Teams Excel. Added **FINAL DIAGNOSIS** field (Kasun's cancer-outcome ask: colorectal cancer / other cancer / benign / not known / other). Case ID = **MRN** now (PID allowed — see governance). Verified live: copy-row = 38 cols matching the Excel; real case marks fine; empty rejected.

**Excel workbook (`2WW-Colorectal-Audit.xlsx`, built with exceljs, delivered):** 3 sheets — **Guide** (how-to), **Data** (38 colour-coded cols, frozen panes, paste-safe dropdowns), **Summary** (live formulas: concordance %, cancer counts, + red **SAFETY cell** = cancers the algorithm would have under-investigated). Columns lock-step with the tool's copy-row (`AUDIT_COLUMNS` in AuditNewPage.tsx).

**Governance decision (Kasun's concern → resolved).** Data stored LOCALLY in a controlled-access Excel in **Teams** — same model as the dept's M&M sheet + handover Patient Lists. **NO external/cloud storage.** PID (MRN) OK because in-tenant under Trust IG. Tool stores/transmits nothing. Matches the Trust's own sanctioned model → audit team should accept. **Power Automate one-click-submit assessed + REJECTED** (NHS requires IG assessment + DPIA + secure auth for any PID flow; anonymous HTTP trigger is the insecure pattern). Keep copy-paste (zero transmission = cleanest story).

**Teams setup:** channel **"AI 2WW Project"** (folder `AI_2WW_Project`) inside Kasun's **"2WW LGI Pathway"** team (tenant = South Warwickshire NHS). Excel uploaded to Files. Recommended tabs: **Website** (ww-colerectal.web.app/audit/new) + **Excel** (the sheet). "Start here" pinned post drafted. **No EPR** → instructions say "your usual clinical system". There is also a `Suspected_Diagnosed_Cancer_Report.xlsx` in the channel — possible ready-made source for the final-diagnosis column (confirm contents).

**Team:** Lead **Mr Kasun Wanigasooriya**; members **Ali Mohamed Elhassan, Lucy-Ann O'Kane, Temitope Ken-Afolabi, Sharanya Arun, Olivia Jackson**. Kasun owns the Teams team (only owners add members; he made Ali co-owner).

**Proposal form:** updated **GEH Clinical Audit Proposal Form** drafted (data-handling → local Teams; aims + methodology → cancer-outcome/safety; fixed leftover AXR/CT text from another audit). Ready to submit to clinical.audit@geh.nhs.uk. Audit registered (ref TBD — user to insert).

**Still pending (Kasun asked):** (1) full **build-record/transcript** of the tool; (2) **outcome-findings section** for the paper. Not yet delivered. Also offered: 2 worked example rows in the Excel; a Word .docx of the proposal form.

**Constraints:** no patient-identifiable data beyond MRN-in-tenant; **never say ASGBI to Kasun**; commit/push only when asked.
