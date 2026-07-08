"""Consistency checker (Phase 4) — the CV-must-match invariant (HARD RULE 6).

The GMC requires CV content to match the application and employment letters.
This runs on every generation and blocks "export" with WARNINGS, not errors:
the user can override but sees exactly which dates/titles/posts mismatch across
the CV, employment letters, and extracted evidence.

Pure, testable logic.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Optional

from app.models import CareerEvent


@dataclass(frozen=True)
class Mismatch:
    field: str
    a_source: str
    a_value: str
    b_source: str
    b_value: str
    detail: str


def _norm(s: Optional[str]) -> str:
    return " ".join((s or "").lower().split())


def compare_events(cv_event: CareerEvent, letter_event: CareerEvent,
                   date_tolerance_days: int = 0) -> list[Mismatch]:
    """Compare a CV post against the matching employment-letter post."""
    out: list[Mismatch] = []

    if _norm(cv_event.post_title) != _norm(letter_event.post_title):
        out.append(Mismatch(
            "post_title", "cv", cv_event.post_title or "",
            "employment_letter", letter_event.post_title or "",
            "post title differs",
        ))
    if _norm(cv_event.employer) != _norm(letter_event.employer):
        out.append(Mismatch(
            "employer", "cv", cv_event.employer or "",
            "employment_letter", letter_event.employer or "",
            "employer differs",
        ))
    for field_name in ("start_date", "end_date"):
        a: Optional[date] = getattr(cv_event, field_name)
        b: Optional[date] = getattr(letter_event, field_name)
        if a and b and abs((a - b).days) > date_tolerance_days:
            out.append(Mismatch(
                field_name, "cv", a.isoformat(),
                "employment_letter", b.isoformat(),
                f"dates differ by {abs((a - b).days)} days",
            ))
    return out


def blocking_warnings(mismatches: list[Mismatch]) -> list[str]:
    """Human-readable warnings that block export until acknowledged."""
    return [
        f"{m.field}: CV says '{m.a_value}' but {m.b_source} says '{m.b_value}' ({m.detail})"
        for m in mismatches
    ]
