from app.models import EvidenceType
from app.pipeline.classify import generate_gmc_title, normalise_evidence_type


def test_normalise_known_and_unknown():
    assert normalise_evidence_type("audit") is EvidenceType.AUDIT
    assert normalise_evidence_type("APPRAISAL") is EvidenceType.APPRAISAL
    assert normalise_evidence_type("nonsense") is EvidenceType.UNKNOWN
    assert normalise_evidence_type(None) is EvidenceType.UNKNOWN


def test_title_is_sanitised_and_bounded():
    title = generate_gmc_title(EvidenceType.AUDIT, "Good Hope Hospital", "2022-05-01")
    assert "Audit" in title
    assert "Good Hope Hospital" in title
    assert "2022-05-01" in title
    for bad in ("/", "\\", ":", "*", "?"):
        assert bad not in title


def test_missing_context_stays_blank_not_invented():
    # HARD RULE 1: no fabrication — missing context is labelled, never guessed.
    title = generate_gmc_title(EvidenceType.CERTIFICATE, None, None)
    assert "Unknown context" in title
    assert "undated" in title
