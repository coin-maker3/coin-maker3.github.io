"""PathwayPack FastAPI application.

Exposes the pipeline and, importantly, a /status endpoint that makes the rules
verification gate (HARD RULE 5) operationally visible: you can see at a glance
which GMC rule sets are still unverified and therefore blocked in production.
"""
from __future__ import annotations

from fastapi import FastAPI

from app.config import get_settings
from app.pipeline import extract as extract_stage
from app.pipeline.classify import generate_gmc_title, normalise_evidence_type
from app.pipeline.redaction import scan
from app.rules.loader import ALL_RULE_SETS, rule_status

app = FastAPI(title="PathwayPack — CESR Evidence Engine", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/status")
def status() -> dict:
    """Operational status, including the rules verification gate."""
    settings = get_settings()
    rules = [rule_status(rs) for rs in ALL_RULE_SETS]
    unverified = [r["rule_set"] for r in rules if not r["verified"]]
    return {
        "environment": settings.environment,
        "personal_mode": settings.personal_mode,
        "unverified_rules_permitted": settings.unverified_rules_permitted,
        "rules": rules,
        "production_blocked_rule_sets": [] if settings.unverified_rules_permitted else unverified,
        "manual_verification_gate_complete": len(unverified) == 0,
    }


@app.post("/dev/scan")
def dev_scan(payload: dict) -> dict:
    """Dev helper: run the redaction scanner over a text blob.

    Returns findings without persisting anything. The safety layer must be easy
    to exercise and audit.
    """
    result = scan(payload.get("text", ""))
    return {
        "has_blocking": result.has_blocking,
        "findings": [
            {
                "type": f.type.value,
                "severity": f.severity.value,
                "text": f.text,
                "start": f.start,
                "end": f.end,
                "reason": f.reason,
            }
            for f in result.sorted()
        ],
    }


@app.post("/dev/extract")
def dev_extract(payload: dict) -> dict:
    """Dev helper: run extraction over provided text (no image/DB)."""
    settings = get_settings()
    result = extract_stage.extract(text=payload.get("text"))
    return {
        "provider": result.provider,
        "document_kind": result.document_kind,
        "career_events": result.career_events,
        "evidence_items": result.evidence_items,
        "min_confidence": result.min_confidence,
        "needs_review": result.needs_review(settings.extraction_confidence_threshold),
        "error": result.error,
    }
