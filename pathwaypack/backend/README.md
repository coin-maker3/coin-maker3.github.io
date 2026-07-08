# PathwayPack backend

FastAPI evidence engine. See `../README.md` for product context and HARD RULES.

## Run

```bash
cd pathwaypack/backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then fill in keys; keep ALLOW_UNVERIFIED_RULES=1 for dev
uvicorn app.main:app --reload
```

## Key endpoints

- `GET /status` — operational status **including the rules verification gate**:
  which GMC rule sets are still unverified and blocked in production.
- `POST /dev/scan` — run the redaction/PII scanner over `{"text": "..."}`.
- `POST /dev/extract` — run extraction over `{"text": "..."}` (needs
  `ANTHROPIC_API_KEY`).

## Tests

```bash
. .venv/bin/activate
pip install pytest python-docx
python -m pytest -q
```

Golden cases live in `tests/golden/cases/*.json`. **Add every real-world
extraction/redaction error Shuker finds as a new golden case** — CI fails on any
regression.

## Layout

```
app/
  config.py            settings + env flags (verification gate, PERSONAL_MODE)
  main.py              FastAPI app + /status (rules gate visible)
  models/              Pydantic models for all MongoDB collections
  rules/loader.py      HARD RULE 5 gate: unverified rules blocked in production
  pipeline/
    extract.py         Phase 1 — Anthropic/Gemini extraction, no-fabrication prompt
    redaction.py       Phase 4 core — PII scanner (NHS mod-11, GMC, DOB, ...)
    classify.py        evidence-type + GMC document titling
    map_cips.py        Phase 3 — CiP mapping (gated on verified GS SSG)
    aggregate.py       employment-gap detection + currency window
    generate.py        Phase 2 — GMC-format CV .docx
    consistency.py     Phase 4 — CV-must-match invariant (HARD RULE 6)
tests/                 unit + golden tests
```

## Not yet built (next phases)

- MongoDB persistence layer + pipeline runner wiring the stages to document
  status records (`app/db.py`, `app/pipeline/runner.py`).
- Magic-link auth (Shuker + Ali only).
- Gmail adapter (Phase 5, `PERSONAL_MODE`, Ali-only).
- Real CiP mapper (embeddings/LLM-judge with rationale) — after `gs_ssg_cips.json`
  is verified.
