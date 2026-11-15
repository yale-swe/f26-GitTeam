"""Milestone detail, milestone/deliverable updates, and progress."""

import uuid
from collections.abc import Callable, Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.main import app
from app.milestone_progress import calculate_progress
from app.models.activity import ActivityItem
from app.models.enums import DeliverableStatus, IntegrationProvider, IntegrationState
from app.models.integration import Integration

ALICE = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
BOB = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
MISSING = "00000000-0000-0000-0000-000000000000"

AsUser = Callable[[uuid.UUID], None]


@pytest.fixture
def as_user(anon_client: TestClient) -> Iterator[AsUser]:
    def _switch(user_id: uuid.UUID) -> None:
        app.dependency_overrides[get_current_user] = lambda: {"sub": str(user_id)}

    _switch(ALICE)
    try:
        yield _switch
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _create_project(client: TestClient) -> dict:
    res = client.post(
        "/api/projects",
        json={
            "name": "Campus Cart",
            "summary": "Marketplace for students.",
            "features": ["Listings"],
            "milestones": [
                {
                    "title": "Beta checkout",
                    "dueAt": "2026-12-01T00:00:00Z",
                    "deliverables": [
                        {"title": "Reserve item", "status": "completed"},
                        {"title": "Notify seller", "status": "in_progress"},
                        {"title": "Expiry rules", "status": "blocked"},
                        {"title": "Edge-case tests"},
                    ],
                },
                {"title": "Launch", "dueAt": "2027-01-15T00:00:00Z"},
            ],
        },
    )
    assert res.status_code == 201
    return res.json()


def _first_milestone(project: dict) -> str:
    return next(m["id"] for m in project["milestones"] if m["title"] == "Beta checkout")


def test_progress_is_completed_over_total_and_bounded() -> None:
    class D:
        def __init__(self, status: DeliverableStatus) -> None:
            self.status = status

    assert calculate_progress([]) == (0, 0, 0)
    done, todo = D(DeliverableStatus.COMPLETED), D(DeliverableStatus.PLANNED)
    assert calculate_progress([done, todo, todo]) == (1, 3, 33)
    assert calculate_progress([done, done]) == (2, 2, 100)


def test_detail_shows_deliverables_progress_and_position(
    anon_client: TestClient, as_user: AsUser
) -> None:
    project = _create_project(anon_client)
    res = anon_client.get(f"/api/projects/{project['id']}/milestones/{_first_milestone(project)}")

    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "Beta checkout"
    assert body["position"] == 1 and body["totalMilestones"] == 2
    assert body["progress"] == {"completed": 1, "total": 4, "percent": 25}
    assert [d["title"] for d in body["deliverables"]] == [
        "Reserve item",
        "Notify seller",
        "Expiry rules",
        "Edge-case tests",
    ]
    assert body["recentActivity"] == []


def test_milestone_without_deliverables_has_zero_progress(
    anon_client: TestClient, as_user: AsUser
) -> None:
    project = _create_project(anon_client)
    launch = next(m["id"] for m in project["milestones"] if m["title"] == "Launch")
    body = anon_client.get(f"/api/projects/{project['id']}/milestones/{launch}").json()
    assert body["position"] == 2
    assert body["progress"] == {"completed": 0, "total": 0, "percent": 0}


def test_updates_milestone_title_date_and_status(anon_client: TestClient, as_user: AsUser) -> None:
    project = _create_project(anon_client)
    url = f"/api/projects/{project['id']}/milestones/{_first_milestone(project)}"

    res = anon_client.patch(
        url,
        json={"title": "Beta checkout v2", "dueAt": "2026-12-10T00:00:00Z", "status": "at_risk"},
    )

    assert res.status_code == 200
    body = res.json()
    assert (body["title"], body["status"]) == ("Beta checkout v2", "at_risk")
    assert body["dueAt"].startswith("2026-12-10")
    # Untouched fields are preserved.
    assert body["progress"]["total"] == 4


def test_rejects_empty_milestone_title(anon_client: TestClient, as_user: AsUser) -> None:
    project = _create_project(anon_client)
    url = f"/api/projects/{project['id']}/milestones/{_first_milestone(project)}"
    assert anon_client.patch(url, json={"title": ""}).status_code == 422


def test_adding_a_deliverable_changes_progress(anon_client: TestClient, as_user: AsUser) -> None:
    project = _create_project(anon_client)
    url = f"/api/projects/{project['id']}/milestones/{_first_milestone(project)}"

    res = anon_client.post(f"{url}/deliverables", json={"title": "Refund flow"})

    assert res.status_code == 201
    assert res.json()["status"] == "planned"
    assert anon_client.get(url).json()["progress"] == {"completed": 1, "total": 5, "percent": 20}


def test_completing_and_reopening_a_deliverable_updates_progress(
    anon_client: TestClient, as_user: AsUser
) -> None:
    project = _create_project(anon_client)
    url = f"/api/projects/{project['id']}/milestones/{_first_milestone(project)}"
    target = anon_client.get(url).json()["deliverables"][1]["id"]
    deliverable_url = f"/api/projects/{project['id']}/deliverables/{target}"

    assert anon_client.patch(deliverable_url, json={"status": "completed"}).status_code == 200
    assert anon_client.get(url).json()["progress"]["percent"] == 50

    anon_client.patch(deliverable_url, json={"status": "in_progress"})
    assert anon_client.get(url).json()["progress"]["percent"] == 25


def test_activity_comes_only_from_healthy_integrations(
    anon_client: TestClient, as_user: AsUser, db_session: Session
) -> None:
    project = _create_project(anon_client)
    project_id = uuid.UUID(project["id"])
    db_session.add_all(
        [
            Integration(
                project_id=project_id,
                provider=IntegrationProvider.GITHUB,
                status=IntegrationState.HEALTHY,
            ),
            Integration(
                project_id=project_id,
                provider=IntegrationProvider.DISCORD,
                status=IntegrationState.STALE,
            ),
            ActivityItem(
                project_id=project_id,
                source=IntegrationProvider.GITHUB,
                source_id="c1",
                kind="commit",
                occurred_at=datetime(2026, 11, 1, tzinfo=UTC),
                title="Add reservation endpoint",
            ),
            ActivityItem(
                project_id=project_id,
                source=IntegrationProvider.DISCORD,
                source_id="m1",
                kind="message",
                occurred_at=datetime(2026, 11, 2, tzinfo=UTC),
                title="stale message",
            ),
        ]
    )
    db_session.commit()

    body = anon_client.get(
        f"/api/projects/{project['id']}/milestones/{_first_milestone(project)}"
    ).json()
    assert [a["title"] for a in body["recentActivity"]] == ["Add reservation endpoint"]


def test_other_users_and_missing_ids_get_not_found(
    anon_client: TestClient, as_user: AsUser
) -> None:
    project = _create_project(anon_client)
    pid, mid = project["id"], _first_milestone(project)
    deliverable = anon_client.get(f"/api/projects/{pid}/milestones/{mid}").json()["deliverables"][0]

    as_user(BOB)
    for method, path, body in [
        ("get", f"/api/projects/{pid}/milestones/{mid}", None),
        ("patch", f"/api/projects/{pid}/milestones/{mid}", {"title": "x"}),
        ("post", f"/api/projects/{pid}/milestones/{mid}/deliverables", {"title": "x"}),
        ("patch", f"/api/projects/{pid}/deliverables/{deliverable['id']}", {"status": "planned"}),
    ]:
        res = anon_client.request(method, path, json=body)
        assert res.status_code == 404, (method, path)

    as_user(ALICE)
    assert anon_client.get(f"/api/projects/{pid}/milestones/{MISSING}").status_code == 404
    assert (
        anon_client.patch(
            f"/api/projects/{pid}/deliverables/{MISSING}", json={"status": "planned"}
        ).status_code
        == 404
    )


def test_milestone_from_another_project_is_not_reachable(
    anon_client: TestClient, as_user: AsUser
) -> None:
    first = _create_project(anon_client)
    second = _create_project(anon_client)
    res = anon_client.get(f"/api/projects/{second['id']}/milestones/{_first_milestone(first)}")
    assert res.status_code == 404


@pytest.mark.skip(reason="Owners and blockers are not stored yet")
def test_assigns_owners_and_tracks_blocker_resolution() -> None:
    pass


@pytest.mark.skip(reason="Activity is not linked to individual milestones yet")
def test_links_github_and_discord_evidence_to_the_correct_milestone() -> None:
    pass
