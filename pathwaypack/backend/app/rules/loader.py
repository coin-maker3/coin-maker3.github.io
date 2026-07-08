"""Rules loader with a HARD verification gate (HARD RULE 5).

Every rules/*.json file must carry a populated `verified_against` block before
it can be served in production. An unverified rule set raises
`UnverifiedRulesError` — the calling pipeline stage fails loudly and records the
failure on the document; it never silently proceeds with unverified GMC rules.

In development, set ALLOW_UNVERIFIED_RULES=1 to work with draft rules. This is
ignored when ENVIRONMENT=production.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import get_settings

_REQUIRED_VERIFICATION_KEYS = {"source_url", "verified_on", "verified_by"}


class RulesError(Exception):
    """Base class for rules problems."""


class RulesNotFoundError(RulesError):
    pass


class UnverifiedRulesError(RulesError):
    """A rule set is being used in production without a valid verified_against."""


def is_verified(rules_doc: dict[str, Any]) -> bool:
    """A rule set is verified iff verified_against is an object carrying all
    required provenance keys with non-empty values."""
    va = rules_doc.get("verified_against")
    if not isinstance(va, dict):
        return False
    return all(va.get(k) for k in _REQUIRED_VERIFICATION_KEYS)


def _read_raw(rule_set: str) -> tuple[dict[str, Any], Path]:
    settings = get_settings()
    path = settings.rules_dir / f"{rule_set}.json"
    if not path.exists():
        raise RulesNotFoundError(f"No rules file at {path}")
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh), path


def load_rules(rule_set: str) -> dict[str, Any]:
    """Load a verified rule set, or raise.

    Raises:
        RulesNotFoundError: file missing.
        UnverifiedRulesError: verified_against absent/incomplete and unverified
            rules are not permitted in this environment.
    """
    doc, path = _read_raw(rule_set)
    if not is_verified(doc):
        settings = get_settings()
        if not settings.unverified_rules_permitted:
            raise UnverifiedRulesError(
                f"Rule set '{rule_set}' ({path}) is UNVERIFIED "
                f"(verified_against is null/incomplete). It cannot be used in "
                f"production. Verify it against the live GMC source and populate "
                f"verified_against, or set ALLOW_UNVERIFIED_RULES=1 in development."
            )
    return doc


def rule_status(rule_set: str) -> dict[str, Any]:
    """Non-raising introspection for the health/status endpoint."""
    try:
        doc, path = _read_raw(rule_set)
    except RulesNotFoundError:
        return {"rule_set": rule_set, "present": False, "verified": False}
    return {
        "rule_set": rule_set,
        "present": True,
        "verified": is_verified(doc),
        "curriculum_version": doc.get("curriculum_version"),
        "verified_against": doc.get("verified_against"),
    }


# Cache verified loads only; unverified paths must keep re-raising as config
# changes, so we do not memoize the raising branch.
@lru_cache
def load_rules_cached(rule_set: str) -> dict[str, Any]:
    return load_rules(rule_set)


ALL_RULE_SETS = (
    "cv_structure",
    "document_titling",
    "gs_ssg_cips",
    "evidence_currency",
    "accepted_file_types",
)
