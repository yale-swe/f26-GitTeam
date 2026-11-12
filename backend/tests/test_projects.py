from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.activity import ActivityItem
from app.models.enums import IntegrationProvider, IntegrationState
from app.models.integration import Integration
from app.models.summary import Summary


def _future(days: int) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


def _plan(**overrides) -> dict:
    base = {
        "name": "Campus Cart",
        "summary": "Marketplace for students to trade used textbooks.",
        "features": ["Listings and discovery", "Verified accounts"],
        "milestones": [
            {
                "title": "Plan approved",
                "dueAt": _future(5),
                "deliverables": [
                    {"title": "Campus email verification"},
                    {"title": "Listing image upload", "status": "in_progress"},
                ],
            },
            {
                "title": "Core marketplace",
                "dueAt": _future(30),
                "status": "in_progress",
                "deliverables": [{"title": "Reservation flow", "status": "completed"}],
            },
        ],
    }
    base.update(overrides)
    return base


def _structured_analysis(project_id: UUID, *, evidence_id: str | None = None) -> dict:
    evidence_id = evidence_id or f"project:{project_id}"
    return {
        "recentProgress": [],
        "upcomingMilestones": [],
        "notableActivity": [],
        "blockers": [
            {
                "text": "The deployment credentials are unavailable.",
                "evidenceIds": [evidence_id],
            }
        ],
        "nextSteps": [
            {
                "text": "Ask the deployment owner for the credentials.",
                "evidenceIds": [evidence_id],
            }
        ],
        "limitations": [],
    }


def test_creates_project_with_features_milestones_and_deadlines(client: TestClient) -> None:
    """UC1-AC1: a valid project plan is persisted and returned."""
    res = client.post("/api/projects", json=_plan())
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Campus Cart"
    assert body["features"] == ["Listings and discovery", "Verified accounts"]
    assert len(body["milestones"]) == 2
    assert {m["title"] for m in body["milestones"]} == {"Plan approved", "Core marketplace"}
    assert body["milestones"][0]["status"] in {"planned", "in_progress", "completed", "at_risk"}

    milestone_ids_by_title = {m["title"]: m["id"] for m in body["milestones"]}
    deliverables = body["deliverables"]
    assert {d["title"] for d in deliverables} == {
        "Campus email verification",
        "Listing image upload",
        "Reservation flow",
    }
    for d in deliverables:
        assert d["status"] in {"planned", "in_progress", "completed", "blocked"}
        assert d["milestoneId"] in milestone_ids_by_title.values()
    reservation = next(d for d in deliverables if d["title"] == "Reservation flow")
    assert reservation["status"] == "completed"
    assert reservation["milestoneId"] == milestone_ids_by_title["Core marketplace"]
    assert "id" in body


@pytest.mark.parametrize(
    "override",
    [
        {"name": ""},
        {"summary": ""},
        {"features": []},
        {"milestones": []},
        {"milestones": [{"title": "", "dueAt": _future(1)}]},
        {
            "milestones": [
                {
                    "title": "Plan approved",
                    "dueAt": _future(5),
                    "deliverables": [{"title": ""}],
                }
            ]
        },
    ],
)
def test_rejects_project_with_missing_or_invalid_required_fields(
    client: TestClient, override: dict
) -> None:
    """UC1-AC3: validation failures must not persist a partial project."""
    res = client.post("/api/projects", json=_plan(**override))
    assert res.status_code == 422
    assert "detail" in res.json()

    listing = client.get("/api/projects").json()
    assert listing == []


def test_deliverables_link_to_their_milestone_and_default_to_planned(
    client: TestClient,
) -> None:
    """Each deliverable carries the id of the milestone it belongs to and
    defaults to `planned` so the progress bar can start counting from zero."""

    payload = {
        "name": "DevSync",
        "summary": "Project-health layer.",
        "features": ["Dashboard"],
        "milestones": [
            {
                "title": "M1",
                "dueAt": _future(5),
                "deliverables": [{"title": "D1"}, {"title": "D2"}],
            },
            {
                "title": "M2",
                "dueAt": _future(20),
                "deliverables": [{"title": "D3", "status": "completed"}],
            },
        ],
    }
    body = client.post("/api/projects", json=payload).json()

    milestone_ids = {m["title"]: m["id"] for m in body["milestones"]}
    by_title = {d["title"]: d for d in body["deliverables"]}
    assert by_title["D1"]["milestoneId"] == milestone_ids["M1"]
    assert by_title["D1"]["status"] == "planned"
    assert by_title["D2"]["milestoneId"] == milestone_ids["M1"]
    assert by_title["D3"]["milestoneId"] == milestone_ids["M2"]
    assert by_title["D3"]["status"] == "completed"


def test_patching_milestones_replaces_their_deliverables(client: TestClient) -> None:
    """Replacing the milestone list through PATCH also replaces its deliverables
    (delete-orphan cascade), so stale deliverables aren't left behind."""

    created = client.post("/api/projects", json=_plan()).json()
    project_id = created["id"]

    patch = client.patch(
        f"/api/projects/{project_id}",
        json={
            "milestones": [
                {
                    "title": "Only milestone",
                    "dueAt": _future(10),
                    "deliverables": [{"title": "Only deliverable"}],
                }
            ]
        },
    )
    assert patch.status_code == 200
    updated = patch.json()
    assert [m["title"] for m in updated["milestones"]] == ["Only milestone"]
    assert [d["title"] for d in updated["deliverables"]] == ["Only deliverable"]
    assert updated["deliverables"][0]["milestoneId"] == updated["milestones"][0]["id"]


def test_retrieves_and_updates_an_existing_project(client: TestClient) -> None:
    """UC1-AC2: PATCH persists only the requested changes."""
    created = client.post("/api/projects", json=_plan()).json()
    project_id = created["id"]

    patch = client.patch(
        f"/api/projects/{project_id}",
        json={"summary": "Updated summary", "features": ["Listings", "Reservations"]},
    )
    assert patch.status_code == 200
    updated = patch.json()
    assert updated["summary"] == "Updated summary"
    assert updated["features"] == ["Listings", "Reservations"]
    assert updated["name"] == created["name"]
    assert len(updated["milestones"]) == len(created["milestones"])

    fetched = client.get(f"/api/projects/{project_id}").json()
    assert fetched == updated


def test_update_rejects_unknown_project(client: TestClient) -> None:
    """UC1-AC4: editing a non-existent project returns 404 and leaves data untouched."""
    created = client.post("/api/projects", json=_plan()).json()
    unknown_id = "00000000-0000-0000-0000-000000000000"

    res = client.patch(f"/api/projects/{unknown_id}", json={"summary": "nope"})
    assert res.status_code == 404

    fetched = client.get(f"/api/projects/{created['id']}").json()
    assert fetched["summary"] == created["summary"]


def test_project_changes_do_not_affect_another_project(client: TestClient) -> None:
    """Updates stay scoped to the project being edited."""
    first = client.post("/api/projects", json=_plan(name="First")).json()
    second = client.post("/api/projects", json=_plan(name="Second")).json()

    client.patch(f"/api/projects/{first['id']}", json={"summary": "First only"})

    reloaded_second = client.get(f"/api/projects/{second['id']}").json()
    assert reloaded_second["summary"] == second["summary"]
    assert reloaded_second["name"] == "Second"


def test_dashboard_returns_stored_project_evidence_and_calculated_health(
    client: TestClient, db_session: Session
) -> None:
    """UC4-AC1/2: return one dashboard response derived from stored project data."""

    created = client.post("/api/projects", json=_plan()).json()
    project_id = UUID(created["id"])
    occurred_at = datetime.now(UTC) - timedelta(hours=1)
    db_session.add_all(
        [
            Integration(
                project_id=project_id,
                provider=IntegrationProvider.GITHUB,
                status=IntegrationState.HEALTHY,
                config={"repositoryOwner": "team", "repositoryName": "devsync"},
                last_successful_sync_at=occurred_at,
            ),
            ActivityItem(
                project_id=project_id,
                source=IntegrationProvider.GITHUB,
                source_id="commit-1",
                kind="commit",
                occurred_at=occurred_at,
                title="Implement dashboard endpoint",
            ),
            Summary(
                project_id=project_id,
                text="The project is progressing against its current milestones.",
            ),
        ]
    )
    db_session.commit()

    response = client.get(f"/api/projects/{project_id}/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["project"]["id"] == str(project_id)
    assert body["healthScore"] is not None
    assert 0 <= body["healthScore"] <= 100
    assert body["overallHealth"] in {"healthy", "at_risk", "blocked"}
    assert body["integrations"] == [
        {
            "provider": "github",
            "status": "healthy",
            "lastSuccessfulSyncAt": occurred_at.isoformat().replace("+00:00", "Z"),
        }
    ]
    assert [item["title"] for item in body["recentActivity"]] == ["Implement dashboard endpoint"]
    assert [item["title"] for item in body["upcomingDeadlines"]] == [
        "Plan approved",
        "Core marketplace",
    ]
    assert body["blockers"] == []
    assert body["nextSteps"] == []
    assert body["analysisStatus"] == "unavailable"
    assert body["latestSummary"]["text"].startswith("The project is progressing")


def test_dashboard_returns_current_structured_blockers_and_next_steps(
    client: TestClient, db_session: Session
) -> None:
    """UC4-AC1/2/4: expose grounded analysis without another provider request."""

    created = client.post("/api/projects", json=_plan()).json()
    project_id = UUID(created["id"])
    now = datetime.now(UTC)
    db_session.add_all(
        [
            Integration(
                project_id=project_id,
                provider=IntegrationProvider.DISCORD,
                status=IntegrationState.HEALTHY,
                config={"channel_id": "project-health"},
                last_successful_sync_at=now - timedelta(hours=2),
            ),
            Summary(
                project_id=project_id,
                text="Stored structured analysis",
                structured_output=_structured_analysis(project_id),
                generated_at=now - timedelta(hours=1),
            ),
        ]
    )
    db_session.commit()

    response = client.get(f"/api/projects/{project_id}/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["analysisStatus"] == "current"
    assert body["blockers"] == ["The deployment credentials are unavailable."]
    assert body["nextSteps"] == ["Ask the deployment owner for the credentials."]
    assert body["blockerDetails"] == [
        {
            "text": "The deployment credentials are unavailable.",
            "evidenceIds": [f"project:{project_id}"],
        }
    ]
    assert body["nextStepDetails"] == [
        {
            "text": "Ask the deployment owner for the credentials.",
            "evidenceIds": [f"project:{project_id}"],
        }
    ]
    assert body["latestSummary"]["text"] == "Stored structured analysis"


def test_dashboard_marks_analysis_stale_after_a_newer_sync(
    client: TestClient, db_session: Session
) -> None:
    """New integration evidence invalidates the previous blocker snapshot."""

    created = client.post("/api/projects", json=_plan()).json()
    project_id = UUID(created["id"])
    now = datetime.now(UTC)
    db_session.add_all(
        [
            Integration(
                project_id=project_id,
                provider=IntegrationProvider.DISCORD,
                status=IntegrationState.HEALTHY,
                config={"channel_id": "project-health"},
                last_successful_sync_at=now - timedelta(minutes=5),
            ),
            Summary(
                project_id=project_id,
                text="Analysis generated before the latest sync",
                structured_output=_structured_analysis(project_id),
                generated_at=now - timedelta(hours=1),
            ),
        ]
    )
    db_session.commit()

    body = client.get(f"/api/projects/{project_id}/dashboard").json()

    assert body["analysisStatus"] == "stale"
    assert body["blockers"] == []
    assert body["nextSteps"] == []
    assert body["blockerDetails"] == []
    assert body["nextStepDetails"] == []
    assert body["latestSummary"] is None


@pytest.mark.parametrize(
    "structured_output",
    [
        {"blockers": []},
        _structured_analysis(
            UUID("00000000-0000-0000-0000-000000000001"),
            evidence_id="activity:not-in-this-project",
        ),
    ],
)
def test_dashboard_treats_invalid_structured_analysis_as_unavailable(
    client: TestClient,
    db_session: Session,
    structured_output: dict,
) -> None:
    """Malformed or ungrounded stored output must not reach the dashboard."""

    created = client.post("/api/projects", json=_plan()).json()
    project_id = UUID(created["id"])
    db_session.add(
        Summary(
            project_id=project_id,
            text="Invalid structured analysis",
            structured_output=structured_output,
        )
    )
    db_session.commit()

    body = client.get(f"/api/projects/{project_id}/dashboard").json()

    assert body["analysisStatus"] == "unavailable"
    assert body["blockers"] == []
    assert body["nextSteps"] == []
    assert body["blockerDetails"] == []
    assert body["nextStepDetails"] == []
    assert body["latestSummary"] is None


def test_dashboard_does_not_present_stale_integration_data_as_current(
    client: TestClient, db_session: Session
) -> None:
    """UC4-AC5: expose stale status without presenting its activity or summary as current."""

    created = client.post("/api/projects", json=_plan()).json()
    project_id = UUID(created["id"])
    db_session.add_all(
        [
            Integration(
                project_id=project_id,
                provider=IntegrationProvider.GITHUB,
                status=IntegrationState.STALE,
                config={"repositoryOwner": "team", "repositoryName": "devsync"},
            ),
            ActivityItem(
                project_id=project_id,
                source=IntegrationProvider.GITHUB,
                source_id="old-commit",
                kind="commit",
                occurred_at=datetime.now(UTC) - timedelta(days=10),
                title="Outdated activity",
            ),
            Summary(project_id=project_id, text="This summary depends on stale activity."),
        ]
    )
    db_session.commit()

    response = client.get(f"/api/projects/{project_id}/dashboard")

    assert response.status_code == 200
    body = response.json()
    assert body["integrations"][0]["status"] == "stale"
    assert body["recentActivity"] == []
    assert body["latestSummary"] is None
    assert body["analysisStatus"] == "unavailable"
    assert body["healthScore"] is None
    assert body["overallHealth"] == "unknown"


def test_dashboard_returns_not_found_for_unknown_project(client: TestClient) -> None:
    response = client.get("/api/projects/00000000-0000-0000-0000-000000000000/dashboard")

    assert response.status_code == 404


@pytest.mark.skip(reason="Project drafts require the auth model (Miguel's area)")
def test_saves_and_resumes_a_project_draft():
    """Preserve incomplete setup data until the user finishes initialization."""
    pass
