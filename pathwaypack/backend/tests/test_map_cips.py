from app.models import EvidenceItem, EvidenceType
from app.pipeline.map_cips import propose_mappings


def test_proposals_carry_rationale_and_confidence():
    item = EvidenceItem(id="e1", applicant_id="a", source_document_id="d1",
                        evidence_type=EvidenceType.AUDIT)
    proposals = propose_mappings(item)
    assert proposals, "audit should match at least one placeholder CiP"
    for p in proposals:
        assert p.rationale                    # every mapping is justified
        assert 0.0 <= p.confidence <= 1.0
        assert p.evidence_item_id == "e1"


def test_unmatched_type_yields_no_forced_mapping():
    # HARD RULE 1: never force a mapping just to fill a CiP.
    item = EvidenceItem(id="e2", applicant_id="a", source_document_id="d1",
                        evidence_type=EvidenceType.UNKNOWN)
    assert propose_mappings(item) == []
