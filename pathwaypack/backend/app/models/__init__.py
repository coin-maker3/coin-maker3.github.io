"""Core data model for PathwayPack (MongoDB collections as Pydantic models).

Collections: applicants, documents, career_events, evidence_items,
cip_mappings, reports.

Guiding invariant (HARD RULE 1 — no fabrication): every extracted field is
Optional and defaults to None. A missing value is left blank and surfaced in
the gap report — it is never inferred. `confidence` accompanies every extracted
claim; below threshold routes to the needs-review queue.
"""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    # Allow constructing with either the field name (`id=`) in app code or the
    # Mongo alias (`_id`) when hydrating from the database.
    model_config = ConfigDict(populate_by_name=True)


# --- shared enums -----------------------------------------------------------

class DocumentSource(str, Enum):
    UPLOAD = "upload"
    GMAIL = "gmail"  # Phase 5, PERSONAL_MODE only


class PipelineStage(str, Enum):
    INGEST = "ingest"
    EXTRACT = "extract"
    REDACTION = "redaction"
    CLASSIFY = "classify"
    MAP = "map"
    AGGREGATE = "aggregate"
    GENERATE = "generate"


class StageState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    NEEDS_REVIEW = "needs_review"
    FAILED = "failed"


class EmploymentType(str, Enum):
    SUBSTANTIVE = "substantive"
    FIXED_TERM = "fixed_term"
    LOCUM = "locum"


class EvidenceType(str, Enum):
    AUDIT = "audit"
    COURSE = "course"
    WBA = "wba"
    PUBLICATION = "publication"
    TEACHING = "teaching"
    APPRAISAL = "appraisal"
    EMPLOYMENT_LETTER = "employment_letter"
    CERTIFICATE = "certificate"
    LOGBOOK = "logbook"
    UNKNOWN = "unknown"


class ReportType(str, Enum):
    CV = "cv"
    GAP = "gap"
    CONSISTENCY = "consistency"
    REDACTION_PREFLIGHT = "redaction_preflight"
    EVIDENCE_INDEX = "evidence_index"


# --- status tracking (failures are visible, never silent) -------------------

class StageStatus(BaseModel):
    stage: PipelineStage
    state: StageState = StageState.PENDING
    message: Optional[str] = None
    updated_at: Optional[datetime] = None


class RedactionFinding(BaseModel):
    type: str
    severity: str
    text: str
    start: int
    end: int
    reason: str
    dismissed: bool = False  # user confirmed it is not an identifier


# --- collections ------------------------------------------------------------

class Applicant(_Base):
    id: Optional[str] = Field(default=None, alias="_id")
    email: str
    full_name: Optional[str] = None
    gmc_reference_number: Optional[str] = None
    specialty: str = "general_surgery"
    target_ssg_version: Optional[str] = None
    created_at: Optional[datetime] = None


class Document(_Base):
    id: Optional[str] = Field(default=None, alias="_id")
    applicant_id: str
    source: DocumentSource = DocumentSource.UPLOAD
    original_filename: Optional[str] = None
    content_type: Optional[str] = None
    storage_ref: Optional[str] = None  # GridFS / object-storage id — never a repo path
    gmc_title: Optional[str] = None    # generated per document_titling.json
    pipeline: list[StageStatus] = Field(default_factory=list)
    redaction_findings: list[RedactionFinding] = Field(default_factory=list)
    needs_review: bool = False
    created_at: Optional[datetime] = None


class CareerEvent(_Base):
    id: Optional[str] = Field(default=None, alias="_id")
    applicant_id: str
    source_document_id: Optional[str] = None
    post_title: Optional[str] = None
    grade: Optional[str] = None
    employer: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    wte_percent: Optional[float] = None
    employment_type: Optional[EmploymentType] = None
    is_gap: bool = False
    gap_reason: Optional[str] = None
    confidence: Optional[float] = None


class EvidenceItem(_Base):
    id: Optional[str] = Field(default=None, alias="_id")
    applicant_id: str
    source_document_id: str
    evidence_type: EvidenceType = EvidenceType.UNKNOWN
    title: Optional[str] = None
    summary: Optional[str] = None          # factual extract only — never embellished
    event_date: Optional[date] = None
    employer_or_context: Optional[str] = None
    raw_extract: Optional[str] = None
    confidence: Optional[float] = None
    needs_review: bool = False


class CipMapping(_Base):
    id: Optional[str] = Field(default=None, alias="_id")
    applicant_id: str
    evidence_item_id: str
    cip_id: str
    hlo_id: Optional[str] = None
    rationale: Optional[str] = None        # why this item maps here
    confidence: Optional[float] = None
    confirmed_by_user: bool = False


class Report(_Base):
    id: Optional[str] = Field(default=None, alias="_id")
    applicant_id: str
    report_type: ReportType
    generated_at: Optional[datetime] = None
    rules_versions: dict[str, Any] = Field(default_factory=dict)  # provenance
    artifact_ref: Optional[str] = None     # docx/pdf in storage
    payload: dict[str, Any] = Field(default_factory=dict)         # structured content
    blocking_warnings: list[str] = Field(default_factory=list)    # CV-must-match
    immutable: bool = True
