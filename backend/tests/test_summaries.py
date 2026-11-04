import pytest
from pydantic import ValidationError

from app.schemas.summary import GeneratedProjectSummary


def _generated_summary(**overrides) -> dict:
    payload = {
        "recentProgress": [
            {
                "text": "The dashboard endpoint was completed.",
                "evidenceIds": ["activity:commit-123"],
            }
        ],
        "upcomingMilestones": [
            {
                "text": "The beta milestone is due next week.",
                "evidenceIds": ["milestone:beta"],
            }
        ],
        "notableActivity": [
            {
                "text": "Pull request 14 was merged.",
                "evidenceIds": ["activity:pr-14"],
            }
        ],
        "blockers": [],
        "nextSteps": [
            {
                "text": "Connect the health page to the dashboard endpoint.",
                "evidenceIds": ["milestone:frontend-integration"],
            }
        ],
        "limitations": [],
    }
    payload.update(overrides)
    return payload


def test_generated_summary_accepts_grounded_structured_sections() -> None:
    summary = GeneratedProjectSummary.model_validate(_generated_summary())

    assert summary.recent_progress[0].text == "The dashboard endpoint was completed."
    assert summary.recent_progress[0].evidence_ids == ["activity:commit-123"]
    assert summary.blockers == []


def test_generated_summary_requires_every_section() -> None:
    payload = _generated_summary()
    payload.pop("nextSteps")

    with pytest.raises(ValidationError):
        GeneratedProjectSummary.model_validate(payload)


def test_generated_claim_requires_supporting_evidence() -> None:
    payload = _generated_summary(blockers=[{"text": "Deployment is blocked.", "evidenceIds": []}])

    with pytest.raises(ValidationError):
        GeneratedProjectSummary.model_validate(payload)


def test_generated_summary_allows_empty_sections_when_evidence_is_unavailable() -> None:
    summary = GeneratedProjectSummary.model_validate(
        _generated_summary(
            recentProgress=[],
            upcomingMilestones=[],
            notableActivity=[],
            blockers=[],
            nextSteps=[],
            limitations=[],
        )
    )

    assert summary.recent_progress == []
    assert summary.upcoming_milestones == []
    assert summary.notable_activity == []


def test_generated_summary_rejects_blank_or_unexpected_content() -> None:
    blank_claim = _generated_summary(
        recentProgress=[{"text": "   ", "evidenceIds": ["activity:commit-123"]}]
    )
    unexpected_field = _generated_summary(confidence="high")

    with pytest.raises(ValidationError):
        GeneratedProjectSummary.model_validate(blank_claim)
    with pytest.raises(ValidationError):
        GeneratedProjectSummary.model_validate(unexpected_field)
