from app.pipeline.redaction import (
    PIIType,
    Severity,
    is_valid_nhs_number,
    redact,
    scan,
)


def test_nhs_checksum_valid_and_invalid():
    assert is_valid_nhs_number("9434765919")   # known valid test NHS number
    assert not is_valid_nhs_number("9434765918")  # wrong check digit
    assert not is_valid_nhs_number("1234567890")  # fails checksum
    assert not is_valid_nhs_number("943476591")   # too short


def test_valid_nhs_number_is_blocking():
    r = scan("NHS No 943 476 5919")
    assert r.has_blocking
    assert any(f.type is PIIType.NHS_NUMBER and f.severity is Severity.BLOCK
               for f in r.findings)


def test_invalid_grouped_nhs_run_is_warn_not_block():
    # 3-3-4 shaped but fails checksum -> WARN so the user still sees it.
    # 123 456 7890 fails the modulus-11 check (check digit resolves to 10).
    r = scan("Ref 123 456 7890 on the form")
    nhs = [f for f in r.findings if f.type is PIIType.NHS_NUMBER]
    assert nhs and all(f.severity is Severity.WARN for f in nhs)


def test_gmc_number_with_context_blocks():
    r = scan("Supervised by GMC 6131234 during the case")
    assert any(f.type is PIIType.GMC_NUMBER and f.severity is Severity.BLOCK
               for f in r.findings)


def test_dob_with_context_blocks():
    r = scan("DOB: 12/03/1978")
    assert any(f.type is PIIType.DATE_OF_BIRTH and f.severity is Severity.BLOCK
               for f in r.findings)


def test_five_planted_identifiers_all_caught():
    """Phase 4 acceptance: 5 planted identifiers, 100% caught."""
    text = (
        "NHS No: 943 476 5919. DOB 01/01/1980. Hospital number: MRN 448812. "
        "Reviewed by GMC 7001234. Address postcode B75 7RR."
    )
    r = scan(text)
    caught = {f.type for f in r.findings}
    for expected in (PIIType.NHS_NUMBER, PIIType.DATE_OF_BIRTH,
                     PIIType.HOSPITAL_NUMBER, PIIType.GMC_NUMBER, PIIType.POSTCODE):
        assert expected in caught, f"missed {expected}"


def test_redact_masks_blocking_only():
    text = "NHS No 943 476 5919 and postcode B75 7RR"
    out = redact(text)
    assert "943 476 5919" not in out          # blocking masked
    assert "[REDACTED:nhs_number]" in out
    assert "B75 7RR" in out                    # WARN left for user confirmation
