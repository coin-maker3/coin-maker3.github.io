"""Classification stage + GMC document titling.

Normalises the extracted evidence_type and generates a GMC-compliant document
title from `rules/document_titling.json`. Titling is rule-driven (HARD RULE 5),
so this stage fails loudly if the titling rules are unverified in production.
"""
from __future__ import annotations

import re
from typing import Optional

from app.models import EvidenceType
from app.rules.loader import load_rules

_VALID = {e.value for e in EvidenceType}


def normalise_evidence_type(raw: Optional[str]) -> EvidenceType:
    if not raw:
        return EvidenceType.UNKNOWN
    key = raw.strip().lower()
    return EvidenceType(key) if key in _VALID else EvidenceType.UNKNOWN


def _sanitise(value: str, disallowed: list[str]) -> str:
    for ch in disallowed:
        value = value.replace(ch, "-")
    return re.sub(r"\s+", " ", value).strip()


def generate_gmc_title(evidence_type: EvidenceType,
                       employer_or_context: Optional[str],
                       event_date: Optional[str]) -> str:
    """Build a GMC-compliant document title. Raises UnverifiedRulesError in
    production if titling rules are not yet verified."""
    rules = load_rules("document_titling")["rules"]
    labels = rules.get("evidence_type_labels", {})
    label = labels.get(evidence_type.value, evidence_type.value.title())
    context = employer_or_context or "Unknown context"
    date = event_date or "undated"
    sep = rules.get("separator", " - ")
    title = sep.join([label, context, date])
    title = _sanitise(title, rules.get("disallowed_characters", []))
    max_len = rules.get("max_length")
    if isinstance(max_len, int) and len(title) > max_len:
        title = title[: max_len].rstrip()
    return title
