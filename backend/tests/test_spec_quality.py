from datetime import date

from app.spec_import.quality import check_plan
from app.spec_import.schemas import ExtractedPlan

TODAY = date(2026, 11, 14)
SOURCE = "Campus Cart. Features: Accounts. Milestones: Core marketplace (2030-10-10): login"


def _plan(**overrides) -> ExtractedPlan:
    base = {
        "name": "Campus Cart",
        "summary": "A marketplace.",
        "features": ["Accounts"],
        "milestones": [
            {"title": "Core marketplace", "date": "2030-10-10", "deliverables": ["login"]}
        ],
    }
    return ExtractedPlan.model_validate({**base, **overrides})


def test_clean_plan_has_no_warnings():
    assert check_plan(_plan(), SOURCE, TODAY) == []
