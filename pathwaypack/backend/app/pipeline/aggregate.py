"""Aggregate stage.

Combines per-document extractions into an applicant-level view and derives:
- employment gaps (GMC requires gaps to be listed explicitly)
- evidence currency flags (within the SSG window)

Gap detection is pure, testable logic. The gap threshold and CV requirements
come from `rules/cv_structure.json`.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from app.models import CareerEvent


@dataclass(frozen=True)
class EmploymentGap:
    start_date: date
    end_date: date

    @property
    def days(self) -> int:
        return (self.end_date - self.start_date).days


def detect_gaps(events: list[CareerEvent], min_gap_days: int = 28) -> list[EmploymentGap]:
    """Find gaps between consecutive posts.

    Only events with both start and end dates participate. Overlapping posts
    (e.g. concurrent locum + substantive) are merged so overlaps don't create
    spurious gaps. A gap is the gap between the running maximum end date and the
    next post's start date, when it exceeds `min_gap_days`.
    """
    dated = sorted(
        (e for e in events if e.start_date and e.end_date and not e.is_gap),
        key=lambda e: (e.start_date, e.end_date),
    )
    gaps: list[EmploymentGap] = []
    running_end: date | None = None
    for ev in dated:
        assert ev.start_date and ev.end_date
        if running_end is None:
            running_end = ev.end_date
            continue
        if ev.start_date > running_end:
            gap_start = running_end + timedelta(days=1)
            gap_end = ev.start_date - timedelta(days=1)
            if (gap_end - gap_start).days + 1 >= min_gap_days:
                gaps.append(EmploymentGap(gap_start, gap_end))
        running_end = max(running_end, ev.end_date)
    return gaps


def within_currency_window(event_date: date, reference: date, window_years: int) -> bool:
    """True if event_date is within `window_years` before the reference date."""
    try:
        cutoff = reference.replace(year=reference.year - window_years)
    except ValueError:  # Feb 29 reference
        cutoff = reference.replace(year=reference.year - window_years, day=28)
    return cutoff <= event_date <= reference
