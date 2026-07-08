from datetime import date

from app.models import CareerEvent
from app.pipeline.aggregate import detect_gaps, within_currency_window


def _ev(start, end, **kw):
    return CareerEvent(applicant_id="a", start_date=start, end_date=end, **kw)


def test_no_gap_when_contiguous():
    events = [
        _ev(date(2019, 1, 1), date(2019, 12, 31)),
        _ev(date(2020, 1, 1), date(2020, 12, 31)),
    ]
    assert detect_gaps(events) == []


def test_detects_gap_over_threshold():
    events = [
        _ev(date(2019, 1, 1), date(2019, 6, 30)),
        _ev(date(2019, 10, 1), date(2019, 12, 31)),  # ~3 month gap
    ]
    gaps = detect_gaps(events, min_gap_days=28)
    assert len(gaps) == 1
    assert gaps[0].start_date == date(2019, 7, 1)
    assert gaps[0].end_date == date(2019, 9, 30)


def test_overlapping_posts_do_not_create_gap():
    events = [
        _ev(date(2019, 1, 1), date(2019, 12, 31)),               # substantive
        _ev(date(2019, 6, 1), date(2019, 8, 31)),                # concurrent locum
        _ev(date(2020, 1, 1), date(2020, 6, 30)),
    ]
    assert detect_gaps(events) == []


def test_small_gap_below_threshold_ignored():
    events = [
        _ev(date(2019, 1, 1), date(2019, 6, 30)),
        _ev(date(2019, 7, 15), date(2019, 12, 31)),  # 14-day gap
    ]
    assert detect_gaps(events, min_gap_days=28) == []


def test_currency_window():
    ref = date(2026, 7, 8)
    assert within_currency_window(date(2021, 7, 8), ref, 6)
    assert not within_currency_window(date(2019, 1, 1), ref, 6)
