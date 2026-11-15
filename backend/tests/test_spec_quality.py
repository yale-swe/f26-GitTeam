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


def test_plan_matching_the_document_has_no_warnings():
    assert check_plan(_plan(), SOURCE, TODAY) == []


def test_past_date_is_flagged():
    plan = _plan(
        milestones=[{"title": "Core marketplace", "date": "2020-01-01", "deliverables": ["login"]}]
    )
    assert check_plan(plan, SOURCE, TODAY) == [
        "Milestone 'Core marketplace' is dated 2020-01-01, which is in the past; check the year."
    ]


def test_item_not_in_document_is_flagged():
    assert check_plan(_plan(features=["Payments"]), SOURCE, TODAY) == [
        "Feature 'Payments' wasn't found in the document; check it wasn't invented."
    ]


def test_blank_item_is_flagged():
    assert check_plan(_plan(features=["   "]), SOURCE, TODAY) == [
        "Feature '   ' wasn't found in the document; check it wasn't invented."
    ]


def test_invented_project_name_is_flagged():
    assert check_plan(_plan(name="StudentMarket"), SOURCE, TODAY) == [
        "Project name 'StudentMarket' wasn't found in the document; check it wasn't invented."
    ]
