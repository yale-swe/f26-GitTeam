from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.enums import (
    HealthStatus,
    IntegrationProvider,
    IntegrationState,
    MilestoneStatus,
)
from app.project_health import calculate_project_health

client = TestClient(app)
NOW = datetime(2026, 10, 14, 12, 0, tzinfo=UTC)


def _milestone(status: MilestoneStatus, days_until_due: int):
    return SimpleNamespace(
        title="Beta release",
        due_at=NOW + timedelta(days=days_until_due),
        status=status,
    )


def _integration(provider: IntegrationProvider, status: IntegrationState):
    return SimpleNamespace(provider=provider, status=status)


def _activity(provider: IntegrationProvider, days_ago: int = 1):
    return SimpleNamespace(
        source=provider,
        occurred_at=NOW - timedelta(days=days_ago),
    )


def _assessment(
    *,
    milestones=None,
    blockers=None,
    activity=None,
    integrations=None,
):
    return calculate_project_health(
        milestones=milestones or [],
        blockers=blockers or [],
        activity=activity or [],
        integrations=integrations or [],
        now=NOW,
    )


def _current_integration_evidence():
    return {
        "activity": [
            _activity(IntegrationProvider.GITHUB),
            _activity(IntegrationProvider.DISCORD),
        ],
        "integrations": [
            _integration(IntegrationProvider.GITHUB, IntegrationState.HEALTHY),
            _integration(IntegrationProvider.DISCORD, IntegrationState.HEALTHY),
        ],
    }


def test_health_returns_ok():
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] in {"ok", "unavailable"}


@pytest.mark.skip(reason="Deliverables do not have completion state in the current schema")
def test_calculates_progress_from_features_and_deliverables():
    """Derive bounded project progress from the approved project plan."""
    pass


def test_flags_overdue_milestones_and_unresolved_blockers():
    """Reflect meaningful schedule and blocker risk in project health."""
    result = _assessment(
        milestones=[_milestone(MilestoneStatus.IN_PROGRESS, -2)],
        blockers=["Deployment is blocked"],
        **_current_integration_evidence(),
    )

    assert result.score is not None
    assert result.status == HealthStatus.BLOCKED


def test_status_is_on_track_when_work_is_on_schedule_without_blockers():
    """Report on track when progress supports the plan and no active risk is present."""
    result = _assessment(
        milestones=[_milestone(MilestoneStatus.IN_PROGRESS, 30)],
        **_current_integration_evidence(),
    )

    assert result.score == 95
    assert result.status == HealthStatus.HEALTHY


def test_in_progress_milestone_scores_higher_than_planned():
    """Do not reward an unstarted milestone over one with active progress."""
    evidence = _current_integration_evidence()
    planned = _assessment(
        milestones=[_milestone(MilestoneStatus.PLANNED, 30)],
        **evidence,
    )
    in_progress = _assessment(
        milestones=[_milestone(MilestoneStatus.IN_PROGRESS, 30)],
        **evidence,
    )

    assert planned.score is not None
    assert in_progress.score is not None
    assert in_progress.score > planned.score


def test_status_needs_attention_when_upcoming_milestone_is_behind_plan():
    """Warn when a near-term milestone lacks enough completed deliverables."""
    result = _assessment(
        milestones=[_milestone(MilestoneStatus.AT_RISK, 5)],
        **_current_integration_evidence(),
    )

    assert result.score == 73
    assert result.status == HealthStatus.AT_RISK


def test_status_is_blocked_when_work_is_overdue():
    """Escalate health when an overdue item threatens the project plan."""
    result = _assessment(
        milestones=[_milestone(MilestoneStatus.PLANNED, -1)],
        **_current_integration_evidence(),
    )

    assert result.status == HealthStatus.BLOCKED


def test_resolving_blocker_recalculates_health_and_status():
    """Improve derived health when the evidence no longer contains an active blocker."""
    evidence = {
        "milestones": [_milestone(MilestoneStatus.IN_PROGRESS, 30)],
        **_current_integration_evidence(),
    }
    blocked = _assessment(blockers=["one", "two", "three", "four"], **evidence)
    resolved = _assessment(blockers=[], **evidence)

    assert blocked.status == HealthStatus.AT_RISK
    assert resolved.status == HealthStatus.HEALTHY
    assert blocked.score is not None
    assert resolved.score is not None
    assert resolved.score > blocked.score


def test_missing_integration_data_is_reported_as_unknown():
    """Do not mark a project unhealthy only because an integration has no data."""
    result = _assessment(
        milestones=[_milestone(MilestoneStatus.IN_PROGRESS, 10)],
    )

    assert result.score is None
    assert result.status == HealthStatus.UNKNOWN


def test_no_activity_from_healthy_integration_lowers_health_score():
    """Treat a successful sync with no activity as evidence of low activity."""
    result = _assessment(
        milestones=[_milestone(MilestoneStatus.IN_PROGRESS, 30)],
        integrations=[
            _integration(IntegrationProvider.GITHUB, IntegrationState.HEALTHY),
        ],
    )

    assert result.score == 64
    assert result.status == HealthStatus.AT_RISK


@pytest.mark.skip(reason="Evidence links require structured blocker and summary schemas")
def test_health_summary_is_grounded_in_project_activity():
    """Link important progress, risk, and next-step claims to stored evidence."""
    pass


def test_unchanged_inputs_produce_the_same_health_result():
    """Keep health calculations stable until relevant source data changes."""
    evidence = {
        "milestones": [_milestone(MilestoneStatus.IN_PROGRESS, 10)],
        **_current_integration_evidence(),
    }

    assert _assessment(**evidence) == _assessment(**evidence)


@pytest.mark.skip(reason="Preserving snapshots requires health-score persistence")
def test_failed_refresh_preserves_the_last_valid_health_result():
    """Do not replace usable health data with a failed or invalid analysis."""
    pass


def test_health_score_endpoint_returns_a_bounded_score():
    request_now = datetime.now(UTC)
    response = client.post(
        "/api/health/score",
        json={
            "milestones": [
                {
                    "title": "Beta release",
                    "dueAt": (request_now + timedelta(days=30)).isoformat(),
                    "status": "in_progress",
                }
            ],
            "blockers": [],
            "activity": [
                {
                    "source": "github",
                    "occurredAt": (request_now - timedelta(days=1)).isoformat(),
                }
            ],
            "integrations": [{"provider": "github", "status": "healthy"}],
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert 0 <= response.json()["score"] <= 100
