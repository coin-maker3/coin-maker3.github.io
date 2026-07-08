from datetime import date

from app.models import CareerEvent
from app.pipeline.consistency import blocking_warnings, compare_events


def _ev(**kw):
    base = dict(applicant_id="a", post_title="Registrar in General Surgery",
                employer="Good Hope Hospital",
                start_date=date(2020, 8, 5), end_date=date(2021, 8, 4))
    base.update(kw)
    return CareerEvent(**base)


def test_matching_events_no_mismatch():
    assert compare_events(_ev(), _ev()) == []


def test_five_planted_mismatches_all_caught():
    """Phase 4 acceptance: 5 planted mismatches, 100% caught."""
    cv = _ev()
    letter = _ev(
        post_title="Senior Registrar",          # 1 title
        employer="Heartlands Hospital",          # 2 employer
        start_date=date(2020, 9, 1),             # 3 start date
        end_date=date(2021, 10, 1),              # 4 end date
    )
    mismatches = compare_events(cv, letter)
    fields = {m.field for m in mismatches}
    assert {"post_title", "employer", "start_date", "end_date"} <= fields

    # 5th planted mismatch: a different employer again on a second post.
    cv2 = _ev(post_title="Fellow", employer="Site A")
    letter2 = _ev(post_title="Fellow", employer="Site B")
    m2 = compare_events(cv2, letter2)
    assert any(m.field == "employer" for m in m2)

    total = mismatches + m2
    assert len(blocking_warnings(total)) == len(total)


def test_date_tolerance():
    cv = _ev(start_date=date(2020, 8, 5))
    letter = _ev(start_date=date(2020, 8, 7))
    assert compare_events(cv, letter, date_tolerance_days=3) == []
    assert compare_events(cv, letter, date_tolerance_days=0)
