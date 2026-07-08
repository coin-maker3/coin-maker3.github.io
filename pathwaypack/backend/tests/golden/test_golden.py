"""Golden-test harness.

Mirrors the TaxTriage pattern: fixed input documents -> expected flags. CI
fails on any regression. Add every real-world extraction/redaction error Shuker
finds as a new golden case JSON in tests/golden/cases/.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.pipeline.redaction import Severity, scan

CASES_DIR = Path(__file__).parent / "cases"
REDACTION_CASES = sorted(p for p in CASES_DIR.glob("*.json")
                         if json.loads(p.read_text()).get("kind") == "redaction")


def _covered_by_blocking(result, text: str) -> bool:
    """True if `text` sits within a BLOCK finding's span."""
    for f in result.findings:
        if f.severity is Severity.BLOCK and text in f.text:
            return True
    return False


@pytest.mark.parametrize("case_path", REDACTION_CASES, ids=lambda p: p.stem)
def test_redaction_golden(case_path: Path):
    case = json.loads(case_path.read_text())
    result = scan(case["text"])

    # Every planted identifier must be caught as BLOCKING.
    for expected in case.get("expected_blocking", []):
        assert _covered_by_blocking(result, expected["text"]), (
            f"{case['name']}: expected blocking finding covering "
            f"'{expected['text']}' ({expected['type']}) — NOT caught"
        )

    # If the case declares no blocking identifiers, none may be raised.
    if not case.get("expected_blocking"):
        assert not result.has_blocking, (
            f"{case['name']}: unexpected blocking findings: "
            f"{[f.text for f in result.findings if f.severity is Severity.BLOCK]}"
        )

    # Expected WARN substrings must appear somewhere in the findings.
    warn_texts = " ".join(f.text for f in result.findings if f.severity is Severity.WARN)
    for needle in case.get("expected_warn_contains", []):
        assert needle in warn_texts, (
            f"{case['name']}: expected WARN covering '{needle}' — not found"
        )
