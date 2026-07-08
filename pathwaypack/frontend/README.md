# PathwayPack frontend (scaffold)

React (Vite + Tailwind), deployed on Vercel. Not implemented in this first
session — the evidence engine (backend) is the product and comes first.

Planned surface, matching the pipeline:

- **Upload** — drag/drop documents (upload-only in the public build; no Gmail).
- **Needs-review queue** — documents whose extraction confidence fell below
  threshold; the user confirms/corrects. Corrections feed the record, not the
  model.
- **Redaction pre-flight** — shows every PII/GMC-number finding before upload to
  the GMC; BLOCK findings masked, WARN findings offered for confirmation.
- **Evidence index** — every document with its generated GMC-compliant title and
  CiP/HLO mapping.
- **Gap report** — CiPs with zero/weak evidence, ranked by severity.
- **Consistency report** — date/title/post mismatches across CV, employment
  letters, and evidence. Export is blocked (overridable) while mismatches exist.
- **CV preview / download** — the GMC-format `.docx`.

Contract: talks only to the backend REST API. No GMC rules or PII logic in the
client.
