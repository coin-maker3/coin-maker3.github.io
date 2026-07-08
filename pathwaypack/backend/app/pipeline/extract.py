"""Extraction stage (Phase 1 core).

Turns a raw document (PDF text or image) into structured career_events and
evidence_items with per-field confidence. Uses the Anthropic API (vision for
photos/scans, text for PDFs); Gemini is the fallback.

HARD RULE 1 — no fabrication. The extraction prompt forbids inventing any
value. Anything not present in the source is returned as null and later
surfaced in the gap report. Confidence below the configured threshold routes
the whole document to the needs-review queue.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional

from app.config import get_settings

# The extraction contract handed to the model. Kept declarative so a human can
# read exactly what the model is asked to do — and see that it is asked to
# extract, never to infer or embellish.
EXTRACTION_SYSTEM_PROMPT = """\
You are an evidence-extraction engine for a UK GMC specialist-registration
application. You extract facts from a single source document. You do NOT
interpret, summarise creatively, embellish, or infer.

ABSOLUTE RULES:
- Only output values that are literally present in the document. If a value is
  not present, output null. Never guess.
- Never write reflections, opinions, outcomes, or descriptions the applicant
  did not themselves record.
- For every field give a confidence 0.0-1.0 reflecting how clearly the value is
  stated in THIS document (not how plausible it is).
- Copy dates, titles, employers, and numbers verbatim; normalise date format to
  ISO (YYYY-MM-DD) only when the components are unambiguous, else keep null and
  put the raw string in `raw`.

Return ONLY valid JSON matching the provided schema.
"""

EXTRACTION_SCHEMA_HINT = {
    "document_kind": "one of: employment_letter, appraisal, certificate, "
                     "audit, course, wba, publication, teaching, logbook, unknown",
    "career_events": [
        {
            "post_title": "string|null",
            "grade": "string|null",
            "employer": "string|null",
            "start_date": "YYYY-MM-DD|null",
            "end_date": "YYYY-MM-DD|null",
            "wte_percent": "number|null",
            "employment_type": "substantive|fixed_term|locum|null",
            "confidence": "0.0-1.0",
            "raw": "string|null",
        }
    ],
    "evidence_items": [
        {
            "evidence_type": "audit|course|wba|publication|teaching|appraisal|"
                             "certificate|logbook|unknown",
            "title": "string|null",
            "summary": "verbatim factual extract only|null",
            "event_date": "YYYY-MM-DD|null",
            "employer_or_context": "string|null",
            "confidence": "0.0-1.0",
            "raw": "string|null",
        }
    ],
}


@dataclass
class ExtractionResult:
    document_kind: str = "unknown"
    career_events: list[dict[str, Any]] = field(default_factory=list)
    evidence_items: list[dict[str, Any]] = field(default_factory=list)
    provider: Optional[str] = None
    raw_response: Optional[str] = None
    error: Optional[str] = None

    @property
    def min_confidence(self) -> Optional[float]:
        confs = [
            c for c in (
                [e.get("confidence") for e in self.career_events]
                + [e.get("confidence") for e in self.evidence_items]
            ) if isinstance(c, (int, float))
        ]
        return min(confs) if confs else None

    def needs_review(self, threshold: float) -> bool:
        mc = self.min_confidence
        return mc is None or mc < threshold


def _user_prompt(text: str | None) -> str:
    return (
        "Extract per the schema below. Output JSON only.\n\n"
        f"SCHEMA:\n{json.dumps(EXTRACTION_SCHEMA_HINT, indent=2)}\n\n"
        f"DOCUMENT TEXT:\n{text or '[no extractable text — use the attached image]'}"
    )


def extract_with_anthropic(text: str | None, image_bytes: bytes | None = None,
                           media_type: str | None = None) -> ExtractionResult:
    """Call the Anthropic API. Raises if the SDK/key is unavailable so the
    runner can fall back to Gemini and record the failure."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    import anthropic  # imported lazily so the module loads without the SDK

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    content: list[dict[str, Any]] = [{"type": "text", "text": _user_prompt(text)}]
    if image_bytes is not None and media_type:
        import base64
        content.insert(0, {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": base64.standard_b64encode(image_bytes).decode("ascii"),
            },
        })

    msg = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4096,
        system=EXTRACTION_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )
    raw = "".join(b.text for b in msg.content if getattr(b, "type", None) == "text")
    return _parse(raw, provider="anthropic")


def extract_with_gemini(text: str | None) -> ExtractionResult:
    """Fallback provider. Implemented as a stub that raises until wired to the
    Gemini SDK — kept explicit so the fallback path is visible, not silent."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    raise NotImplementedError("Gemini fallback not yet wired")


def _parse(raw: str, provider: str) -> ExtractionResult:
    try:
        # tolerate models that wrap JSON in prose/fences
        start = raw.find("{")
        end = raw.rfind("}")
        data = json.loads(raw[start : end + 1]) if start != -1 else {}
    except (json.JSONDecodeError, ValueError) as exc:
        return ExtractionResult(provider=provider, raw_response=raw,
                                error=f"unparseable JSON: {exc}")
    return ExtractionResult(
        document_kind=data.get("document_kind", "unknown"),
        career_events=data.get("career_events", []) or [],
        evidence_items=data.get("evidence_items", []) or [],
        provider=provider,
        raw_response=raw,
    )


def extract(text: str | None, image_bytes: bytes | None = None,
            media_type: str | None = None) -> ExtractionResult:
    """Extract with Anthropic, falling back to Gemini. Never raises — a total
    failure returns a result carrying `error` so the stage is marked FAILED and
    surfaced, never silently dropped."""
    try:
        return extract_with_anthropic(text, image_bytes, media_type)
    except Exception as primary:  # noqa: BLE001 — we want to try the fallback
        try:
            res = extract_with_gemini(text)
            res.error = f"anthropic failed ({primary}); used gemini"
            return res
        except Exception as fallback:  # noqa: BLE001
            return ExtractionResult(
                error=f"anthropic failed: {primary}; gemini failed: {fallback}"
            )
