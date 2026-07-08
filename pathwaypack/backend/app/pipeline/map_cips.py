"""CiP mapping stage (Phase 3 scaffold).

Maps evidence_items to General Surgery SSG CiPs/HLOs. The CiP definitions come
from `rules/gs_ssg_cips.json` (HARD RULE 5), so in production this stage refuses
to run until that file is verified against the current GS SSG PDF — which is
exactly the safety behaviour we want, because a wrong CiP list produces a wrong,
confidence-destroying gap report.

The concrete mapping model (embeddings / rubric / LLM-judge with rationale) is
Phase 3 work; this scaffold wires the rules gate and the data shape.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from app.models import EvidenceItem
from app.rules.loader import load_rules


@dataclass
class ProposedMapping:
    evidence_item_id: str
    cip_id: str
    hlo_id: Optional[str]
    rationale: str
    confidence: float


def load_cips() -> list[dict[str, Any]]:
    """Load verified GS SSG CiPs. Raises UnverifiedRulesError in production
    until the SSG has been verified."""
    return load_rules("gs_ssg_cips")["rules"]["cips"]


def mapping_threshold() -> float:
    return float(load_rules("gs_ssg_cips")["rules"].get("mapping_confidence_threshold", 0.6))


def propose_mappings(item: EvidenceItem) -> list[ProposedMapping]:
    """Return candidate CiP mappings for one evidence item.

    Placeholder heuristic: match on the CiP's `example_evidence_types`. Replaced
    in Phase 3 by a proper mapper that emits a real rationale string. Kept
    deliberately conservative — it proposes, never asserts, and every mapping
    carries a rationale and confidence for user confirmation.
    """
    proposals: list[ProposedMapping] = []
    for cip in load_cips():
        examples = cip.get("example_evidence_types", [])
        if item.evidence_type.value in examples:
            proposals.append(ProposedMapping(
                evidence_item_id=item.id or "",
                cip_id=cip["id"],
                hlo_id=None,
                rationale=(
                    f"Evidence type '{item.evidence_type.value}' is listed as "
                    f"example evidence for CiP '{cip.get('title')}'. "
                    f"[heuristic — confirm]"
                ),
                confidence=0.5,
            ))
    return proposals
