# Rules JSON contract

Every `rules/*.json` file MUST carry a top-level `verified_against` field.

```jsonc
{
  "rule_set": "cv_structure",
  "curriculum_version": null,          // e.g. "General Surgery 2021" — where applicable
  "verified_against": null,            // null => UNVERIFIED, blocked in production
  // when verified, replace null with:
  // "verified_against": {
  //   "source_url": "https://www.gmc-uk.org/...",
  //   "source_title": "Structuring your CV for a specialist or GP registration application",
  //   "verified_on": "2026-07-08",
  //   "verified_by": "Ali",
  //   "notes": "checked line-by-line"
  // }
  "rules": { /* rule-set specific */ }
}
```

## Verification gate

`app/rules/loader.py` refuses to serve any rule set whose `verified_against` is
`null` (or missing required keys) **unless** `ALLOW_UNVERIFIED_RULES=1` is set
(development only). In production the pipeline stage that needs an unverified
rule set fails loudly and records the failure on the document — it never
silently proceeds with unverified GMC rules.

## Why the content below is a DRAFT

The `rules` bodies checked in now are **drafts pending manual verification**.
They exist so the schema, loader, and pipeline can be built and tested. They are
marked `verified_against: null` precisely so nobody mistakes them for
GMC-confirmed. Do not remove the null until a human has checked the values
against the live GMC page and filled in the `verified_against` block. This is
HARD RULE 5.
