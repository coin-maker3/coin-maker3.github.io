"""Redaction / PII scanner — the safety-critical layer (HARD RULE 2).

Unredacted evidence gets deleted by the GMC and forces resubmission. This
scanner flags and masks patient identifiers (NHS numbers, hospital numbers,
dates of birth, addresses) and colleague GMC numbers in ALL extracted text
before it reaches any output.

Design notes
------------
- Precision matters, but for a safety layer we bias toward recall: a false
  positive costs the user a glance; a false negative can cost the whole
  application. Every finding is surfaced; the user can dismiss.
- NHS numbers are validated with the official modulus-11 checksum so a random
  10-digit run (e.g. an invoice number) is not flagged as an NHS number —
  while still being caught by the generic long-digit-run rule if near a
  clinical keyword.
- This module is pure (no I/O) and fully golden-tested. See
  tests/golden/ and tests/test_redaction.py.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum


class PIIType(str, Enum):
    NHS_NUMBER = "nhs_number"
    GMC_NUMBER = "gmc_number"
    DATE_OF_BIRTH = "date_of_birth"
    HOSPITAL_NUMBER = "hospital_number"
    POSTCODE = "postcode"
    DATE = "date"  # generic date — lower severity, context-dependent


class Severity(str, Enum):
    # BLOCK: must be masked before any output leaves the system.
    BLOCK = "block"
    # WARN: likely identifier, surfaced for user confirmation.
    WARN = "warn"


@dataclass(frozen=True)
class Finding:
    type: PIIType
    severity: Severity
    text: str
    start: int
    end: int
    reason: str


@dataclass
class ScanResult:
    findings: list[Finding] = field(default_factory=list)

    @property
    def has_blocking(self) -> bool:
        return any(f.severity is Severity.BLOCK for f in self.findings)

    def sorted(self) -> list[Finding]:
        return sorted(self.findings, key=lambda f: (f.start, f.end))


# --- NHS number -------------------------------------------------------------

# 10 digits, optionally grouped 3-3-4 with spaces or hyphens.
_NHS_RE = re.compile(r"(?<!\d)(\d{3})[ -]?(\d{3})[ -]?(\d{4})(?!\d)")


def is_valid_nhs_number(digits: str) -> bool:
    """Official NHS number modulus-11 check.

    Weights 10..2 applied to the first 9 digits; check digit = 11 - (sum % 11).
    A result of 11 maps to 0; a result of 10 is invalid (no such NHS number).
    """
    if len(digits) != 10 or not digits.isdigit():
        return False
    total = sum(int(d) * w for d, w in zip(digits[:9], range(10, 1, -1)))
    remainder = total % 11
    check = 11 - remainder
    if check == 11:
        check = 0
    if check == 10:
        return False
    return check == int(digits[9])


# --- GMC number -------------------------------------------------------------

# 7-digit GMC reference. To avoid flagging every 7-digit run, we require a
# nearby cue ("GMC", "registration") OR treat a bare 7-digit run as WARN.
_GMC_CONTEXT_RE = re.compile(
    r"(?:GMC(?:\s*(?:no\.?|number|ref(?:erence)?)?)?[:\s#]*)(\d{7})(?!\d)",
    re.IGNORECASE,
)
_SEVEN_DIGITS_RE = re.compile(r"(?<!\d)\d{7}(?!\d)")


# --- Date of birth ----------------------------------------------------------

_DOB_CONTEXT_RE = re.compile(
    r"(?:\b(?:d\.?o\.?b\.?|date\s+of\s+birth|born|dob)\b[:\s]*)"
    r"(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}"
    r"|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})",
    re.IGNORECASE,
)

# Generic date (numeric or "12 May 1980"). Lower severity.
_DATE_RE = re.compile(
    r"(?<!\d)(?:\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}"
    r"|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4})",
    re.IGNORECASE,
)


# --- UK postcode ------------------------------------------------------------

_POSTCODE_RE = re.compile(
    r"\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b", re.IGNORECASE
)


# --- Hospital / MRN ---------------------------------------------------------

# Hospital numbers are heterogeneous. We flag digit runs (6-10) that sit near a
# clinical keyword as WARN.
_HOSPITAL_CONTEXT_RE = re.compile(
    r"(?:\b(?:hospital\s*(?:no\.?|number)|mrn|patient\s*(?:id|no\.?|number)|"
    r"unit\s*(?:no\.?|number))\b[:\s#]*)([A-Z]?\d{5,10})",
    re.IGNORECASE,
)


def _add(findings: list[Finding], f: Finding) -> None:
    # Deduplicate exact spans; keep the higher-severity / more-specific first.
    for existing in findings:
        if existing.start == f.start and existing.end == f.end:
            return
    findings.append(f)


def scan(text: str) -> ScanResult:
    """Scan text for patient/colleague identifiers. Pure function."""
    findings: list[Finding] = []
    if not text:
        return ScanResult(findings)

    # NHS numbers (checksum-validated => BLOCK; near-miss grouped run => WARN)
    for m in _NHS_RE.finditer(text):
        digits = re.sub(r"[ -]", "", m.group(0))
        grouped = (" " in m.group(0)) or ("-" in m.group(0))
        if is_valid_nhs_number(digits):
            _add(findings, Finding(
                PIIType.NHS_NUMBER, Severity.BLOCK, m.group(0), m.start(), m.end(),
                "10-digit run passing the NHS modulus-11 checksum",
            ))
        elif grouped:
            _add(findings, Finding(
                PIIType.NHS_NUMBER, Severity.WARN, m.group(0), m.start(), m.end(),
                "NHS-number-shaped (3-3-4) run that fails the checksum — confirm",
            ))

    # GMC numbers with explicit context => BLOCK
    for m in _GMC_CONTEXT_RE.finditer(text):
        _add(findings, Finding(
            PIIType.GMC_NUMBER, Severity.BLOCK, m.group(1), m.start(1), m.end(1),
            "7-digit run adjacent to a 'GMC' cue",
        ))

    # Dates of birth with explicit context => BLOCK
    for m in _DOB_CONTEXT_RE.finditer(text):
        _add(findings, Finding(
            PIIType.DATE_OF_BIRTH, Severity.BLOCK, m.group(1), m.start(1), m.end(1),
            "date adjacent to a date-of-birth cue",
        ))

    # Hospital / MRN with context => BLOCK
    for m in _HOSPITAL_CONTEXT_RE.finditer(text):
        _add(findings, Finding(
            PIIType.HOSPITAL_NUMBER, Severity.BLOCK, m.group(1), m.start(1), m.end(1),
            "identifier adjacent to a hospital/patient-number cue",
        ))

    # Postcodes => WARN (may be an employer address, but flag for review)
    for m in _POSTCODE_RE.finditer(text):
        _add(findings, Finding(
            PIIType.POSTCODE, Severity.WARN, m.group(0), m.start(), m.end(),
            "UK-postcode-shaped token",
        ))

    # Bare 7-digit runs not already flagged => WARN (possible GMC number)
    already = {(f.start, f.end) for f in findings}
    for m in _SEVEN_DIGITS_RE.finditer(text):
        if (m.start(), m.end()) in already:
            continue
        # skip if inside an already-flagged NHS span
        if any(f.start <= m.start() and m.end() <= f.end for f in findings):
            continue
        _add(findings, Finding(
            PIIType.GMC_NUMBER, Severity.WARN, m.group(0), m.start(), m.end(),
            "bare 7-digit run — possible GMC number, confirm",
        ))

    # Generic dates => WARN (only if not already a DOB span)
    dob_spans = [(f.start, f.end) for f in findings if f.type is PIIType.DATE_OF_BIRTH]
    for m in _DATE_RE.finditer(text):
        if any(s <= m.start() and m.end() <= e for s, e in dob_spans):
            continue
        _add(findings, Finding(
            PIIType.DATE, Severity.WARN, m.group(0), m.start(), m.end(),
            "date token — confirm it is not a date of birth",
        ))

    return ScanResult(findings)


_MASK = "[REDACTED:{}]"


def redact(text: str, result: ScanResult | None = None,
           mask_severities: tuple[Severity, ...] = (Severity.BLOCK,)) -> str:
    """Return `text` with the given severities masked.

    Default masks only BLOCK findings (definite identifiers). WARN findings are
    surfaced to the user for confirmation and masked on their instruction.
    """
    if result is None:
        result = scan(text)
    to_mask = [f for f in result.findings if f.severity in mask_severities]
    # Replace right-to-left so offsets stay valid.
    out = text
    for f in sorted(to_mask, key=lambda f: f.start, reverse=True):
        out = out[: f.start] + _MASK.format(f.type.value) + out[f.end:]
    return out
