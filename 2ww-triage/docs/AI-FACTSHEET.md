# 2WW Colorectal Triage Aid — Technical Factsheet (AI & Data Handling)

*Prepared for the GEH Clinical Audit & QI office / AI Committee, July 2026. Project lead: Mr Kasun Wanigasooriya, Consultant Colorectal and General Surgeon.*

## What the tool is

A web-based **deterministic calculator** that encodes George Eliot Hospital's existing
2WW colorectal investigation algorithm (the Trust's current approved pathway document)
as a fixed decision tree.

- **No artificial intelligence or machine learning runs in the tool.** It contains no
  model, nothing that learns or adapts, and it calls no AI service. Identical inputs
  always produce identical outputs.
- Every result displays the exact algorithm steps followed, stamped with the algorithm
  version (currently GEH-2WW-COLORECTAL v0.4.0), so each output is fully traceable.
- Behaviour is covered by an automated test suite (95 tests), and the branch-by-branch
  mapping to the Trust algorithm document has been reviewed clinically.

## Where AI was involved — development only

An AI coding assistant (**Claude, by Anthropic**) was used **during software
development** to help write the code, in the same way such assistants are now widely
used in software engineering. The clinical logic was specified from the Trust's
algorithm document and directed by the clinical team; the resulting code is
deterministic, human-reviewed and version-controlled. **No AI is involved when the
tool is used.** No patient data of any kind was used in development.

## Data handling

- **The tool stores and transmits nothing.** It is used as an on-screen calculator:
  reviewers type case parameters into the page, read the recommendation, and copy the
  row out. No database sits behind the form; nothing entered is sent to, or retained
  by, any server (the earlier patient-upload pathway was disabled at Mr
  Wanigasooriya's request and its server endpoints return 403).
- Audit data is recorded directly into a **controlled-access Excel workbook within the
  Trust's Microsoft Teams environment**, mirroring existing departmental practice
  (e.g. M&M and handover lists). MRN is used as the case identifier **inside the Trust
  tenant only**; no patient-identifiable data leaves Trust-controlled systems.
- The tool is free, built in-house by the project team; there is no vendor, licence,
  cost, trial, or procurement.

## Clinical safety position

- The tool's recommendations are **not used in patient care**. The audit is
  **retrospective**: reviewers transcribe anonymised parameters from cases already
  seen and decided in clinic, and the audit measures how often the tool's
  recommendation matches the investigation the clinician actually requested
  (concordance), including structured classification of any disagreement and its
  safety direction (would the tool have under- or over-investigated).
- A pilot banner on every page states the tool is for audit use only and is not a
  Trust-endorsed clinical decision support tool.
- Any future use beyond this retrospective audit would be a separate proposal with the
  appropriate governance (IG, DPIA, clinical-safety) sought first.

## Links

- Tool (calculator page used by reviewers): https://ww-colerectal.web.app/audit/new
- Algorithm overview mapping every branch to the Trust document: available on request
  (docs/ALGORITHM-OVERVIEW.md), as are the audit protocol and test suite.
