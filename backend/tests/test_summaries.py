import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.openrouter import OpenRouterError
from app.models.activity import ActivityItem
from app.models.deliverable import Deliverable
from app.models.enums import (
    DeliverableStatus,
    IntegrationProvider,
    IntegrationState,
    MilestoneStatus,
)
from app.models.integration import Integration
from app.models.milestone import Milestone
from app.models.project import Project
from app.models.summary import Summary
from app.schemas.summary import GeneratedProjectSummary
from app.services import summary_generation
from app.services.summary_context import build_summary_context


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


def test_summary_context_contains_grounded_project_evidence(db_session: Session) -> None:
    ids = {
        kind: uuid.uuid4()
        for kind in ["project", "milestone", "deliverable", "integration", "activity"]
    }
    now = datetime.now(UTC)
    project = Project(
        id=ids["project"],
        name="DevSync",
        summary="Project-health coordination for small teams.",
        features=["Health dashboard"],
    )
    milestone = Milestone(
        id=ids["milestone"],
        project=project,
        title="Dashboard integration",
        due_at=now + timedelta(days=7),
        status=MilestoneStatus.IN_PROGRESS,
    )
    deliverable = Deliverable(
        id=ids["deliverable"],
        project=project,
        milestone=milestone,
        title="Generate a grounded summary",
        status=DeliverableStatus.IN_PROGRESS,
    )
    integration = Integration(
        id=ids["integration"],
        project=project,
        provider=IntegrationProvider.GITHUB,
        status=IntegrationState.HEALTHY,
        config={"repository": "private-repo", "access_token": "do-not-send"},
        last_successful_sync_at=now,
    )
    activity = ActivityItem(
        id=ids["activity"],
        project=project,
        source=IntegrationProvider.GITHUB,
        source_id="commit-123",
        kind="commit",
        occurred_at=now,
        title="Add structured summary context",
        details={"private_payload": "do-not-send"},
    )
    db_session.add_all([project, milestone, deliverable, integration, activity])
    db_session.commit()

    context = build_summary_context(db_session, project.id)

    assert context.project.evidence_id == f"project:{ids['project']}"
    assert context.milestones[0].evidence_id == f"milestone:{ids['milestone']}"
    assert context.milestones[0].deliverables[0].evidence_id == (
        f"deliverable:{ids['deliverable']}"
    )
    assert context.activity[0].evidence_id == f"activity:{ids['activity']}"
    assert context.integrations[0].evidence_id == f"integration:{ids['integration']}"
    assert context.health.score is not None
    assert context.valid_evidence_ids == {
        f"project:{ids['project']}",
        f"milestone:{ids['milestone']}",
        f"deliverable:{ids['deliverable']}",
        f"integration:{ids['integration']}",
        f"activity:{ids['activity']}",
    }
    serialized = context.model_dump_json()
    assert "do-not-send" not in serialized
    assert "private_payload" not in serialized


def test_summary_context_excludes_stale_and_other_project_activity(
    db_session: Session,
) -> None:
    now = datetime.now(UTC)
    project = Project(
        name="Current project",
        summary="Only this project's evidence belongs in the context.",
        features=["Summary"],
        milestones=[
            Milestone(
                title="Summary MVP",
                due_at=now + timedelta(days=10),
                status=MilestoneStatus.IN_PROGRESS,
            )
        ],
    )
    other_project = Project(
        name="Other project",
        summary="Must stay isolated.",
        features=["Unrelated"],
        milestones=[
            Milestone(
                title="Other milestone",
                due_at=now + timedelta(days=20),
                status=MilestoneStatus.PLANNED,
            )
        ],
    )
    stale_discord = ActivityItem(
        project=project,
        source=IntegrationProvider.DISCORD,
        source_id="stale-message",
        kind="message",
        occurred_at=now,
        title="Stale Discord message",
    )
    current_activity = ActivityItem(
        project=project,
        source=IntegrationProvider.GITHUB,
        source_id="current-commit",
        kind="commit",
        occurred_at=now - timedelta(hours=1),
        title="Current project's commit",
    )
    other_activity = ActivityItem(
        project=other_project,
        source=IntegrationProvider.GITHUB,
        source_id="other-commit",
        kind="commit",
        occurred_at=now,
        title="Another project's commit",
    )
    db_session.add_all(
        [
            project,
            other_project,
            Integration(
                project=project,
                provider=IntegrationProvider.DISCORD,
                status=IntegrationState.STALE,
                config={"channel_id": "private-channel"},
            ),
            stale_discord,
            Integration(
                project=project,
                provider=IntegrationProvider.GITHUB,
                status=IntegrationState.HEALTHY,
                config={},
            ),
            current_activity,
            Integration(
                project=other_project,
                provider=IntegrationProvider.GITHUB,
                status=IntegrationState.HEALTHY,
                config={},
            ),
            other_activity,
        ]
    )
    db_session.commit()

    context = build_summary_context(db_session, project.id)

    assert [item.title for item in context.activity] == ["Current project's commit"]
    assert any("Discord integration is stale" in item for item in context.limitations)


def test_summary_context_limits_activity_to_the_most_recent_items(db_session: Session) -> None:
    now = datetime.now(UTC)
    project = Project(
        name="Activity project",
        summary="Recent evidence should be bounded.",
        features=["Activity"],
        milestones=[
            Milestone(
                title="Activity milestone",
                due_at=now + timedelta(days=30),
                status=MilestoneStatus.IN_PROGRESS,
            )
        ],
    )
    integration = Integration(
        project=project,
        provider=IntegrationProvider.GITHUB,
        status=IntegrationState.HEALTHY,
        config={},
    )
    activity = [
        ActivityItem(
            project=project,
            source=IntegrationProvider.GITHUB,
            source_id=f"commit-{index}",
            kind="commit",
            occurred_at=now - timedelta(hours=index),
            title=f"Commit {index}",
        )
        for index in range(3)
    ]
    db_session.add_all([project, integration, *activity])
    db_session.commit()

    context = build_summary_context(db_session, project.id, activity_limit=2)

    assert [item.title for item in context.activity] == ["Commit 0", "Commit 1"]


def _project_payload() -> dict:
    return {
        "name": "DevSync",
        "summary": "Project-health coordination for small teams.",
        "features": ["Health summary"],
        "milestones": [
            {
                "title": "Summary MVP",
                "dueAt": (datetime.now(UTC) + timedelta(days=10)).isoformat(),
                "status": "in_progress",
                "deliverables": [
                    {
                        "title": "Generate and store a grounded summary",
                        "status": "in_progress",
                    }
                ],
            }
        ],
    }


def _generated_from_context(context) -> GeneratedProjectSummary:
    milestone = context.milestones[0]
    deliverable = milestone.deliverables[0]
    return GeneratedProjectSummary(
        recent_progress=[],
        upcoming_milestones=[
            {
                "text": "The Summary MVP milestone is upcoming.",
                "evidence_ids": [milestone.evidence_id],
            }
        ],
        notable_activity=[],
        blockers=[],
        next_steps=[
            {
                "text": "Complete summary generation and persistence.",
                "evidence_ids": [deliverable.evidence_id],
            }
        ],
        limitations=context.limitations,
    )


def test_summary_endpoint_generates_stores_and_returns_latest_summary(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created = client.post("/api/projects", json=_project_payload()).json()
    project_id = uuid.UUID(created["id"])
    monkeypatch.setattr(
        summary_generation,
        "generate_project_summary",
        _generated_from_context,
    )

    response = client.post(f"/api/projects/{project_id}/summaries")

    assert response.status_code == 201
    body = response.json()
    assert body["projectId"] == str(project_id)
    assert "Recent progress:" in body["text"]
    assert "Upcoming milestones:" in body["text"]
    assert "Blockers:" in body["text"]
    assert "Next steps:" in body["text"]
    assert "Limitations:" in body["text"]
    assert "Evidence: milestone:" in body["text"]

    stored = list(db_session.scalars(select(Summary).where(Summary.project_id == project_id)))
    assert len(stored) == 1
    assert stored[0].id == uuid.UUID(body["id"])

    dashboard = client.get(f"/api/projects/{project_id}/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["latestSummary"]["id"] == body["id"]


def test_summary_endpoint_preserves_last_summary_when_provider_fails(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created = client.post("/api/projects", json=_project_payload()).json()
    project_id = uuid.UUID(created["id"])
    previous = Summary(project_id=project_id, text="Previous successful summary")
    db_session.add(previous)
    db_session.commit()

    def fail_generation(context):
        raise OpenRouterError("OpenRouter is currently unavailable", code="openrouter_unavailable")

    monkeypatch.setattr(summary_generation, "generate_project_summary", fail_generation)

    response = client.post(f"/api/projects/{project_id}/summaries")

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "openrouter_unavailable"
    stored = list(db_session.scalars(select(Summary).where(Summary.project_id == project_id)))
    assert len(stored) == 1
    assert stored[0].id == previous.id
    assert stored[0].text == "Previous successful summary"


def test_summary_endpoint_returns_not_found_without_calling_provider(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    called = False

    def should_not_generate(context):
        nonlocal called
        called = True
        return _generated_from_context(context)

    monkeypatch.setattr(summary_generation, "generate_project_summary", should_not_generate)

    response = client.post("/api/projects/00000000-0000-0000-0000-000000000000/summaries")

    assert response.status_code == 404
    assert called is False


def test_summary_endpoint_requires_authentication(anon_client: TestClient) -> None:
    response = anon_client.post("/api/projects/00000000-0000-0000-0000-000000000000/summaries")

    assert response.status_code == 401
