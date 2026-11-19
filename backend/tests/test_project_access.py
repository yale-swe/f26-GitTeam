"""Project access control: users only see and change projects they belong to."""

import uuid
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.main import app
from app.models.enums import ProjectRole
from app.models.project_member import ProjectMember
from app.services import summary_generation

ALICE = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
BOB = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
MISSING = "00000000-0000-0000-0000-000000000000"

AsUser = Callable[[uuid.UUID], None]


@pytest.fixture
def as_user(anon_client: TestClient) -> Iterator[AsUser]:
    """Switch which Supabase user the stubbed authentication returns."""

    def _switch(user_id: uuid.UUID) -> None:
        app.dependency_overrides[get_current_user] = lambda: {"sub": str(user_id)}

    try:
        yield _switch
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _payload(name: str = "Campus Cart") -> dict:
    return {
        "name": name,
        "summary": "Marketplace for students to trade used textbooks.",
        "features": ["Listings"],
        "milestones": [{"title": "Plan approved", "dueAt": "2026-12-01T00:00:00Z"}],
    }


def _create(client: TestClient, name: str = "Campus Cart") -> str:
    res = client.post("/api/projects", json=_payload(name))
    assert res.status_code == 201
    return res.json()["id"]


def test_creator_becomes_the_owner(
    anon_client: TestClient, as_user: AsUser, db_session: Session
) -> None:
    as_user(ALICE)
    project_id = _create(anon_client)

    members = db_session.scalars(
        select(ProjectMember).where(ProjectMember.project_id == uuid.UUID(project_id))
    ).all()
    assert [(m.user_id, m.role) for m in members] == [(ALICE, ProjectRole.OWNER)]


def test_list_only_returns_the_callers_projects(anon_client: TestClient, as_user: AsUser) -> None:
    as_user(ALICE)
    alice_project = _create(anon_client, "Alice's project")
    as_user(BOB)
    bob_project = _create(anon_client, "Bob's project")

    assert [p["id"] for p in anon_client.get("/api/projects").json()] == [bob_project]
    as_user(ALICE)
    assert [p["id"] for p in anon_client.get("/api/projects").json()] == [alice_project]


def test_other_users_get_not_found_for_every_project_route(
    anon_client: TestClient, as_user: AsUser, monkeypatch: pytest.MonkeyPatch
) -> None:
    as_user(ALICE)
    project_id = _create(anon_client)

    def must_not_generate(*args: object, **kwargs: object) -> None:
        raise AssertionError("the LLM must not be called for a project the user cannot access")

    monkeypatch.setattr(summary_generation, "generate_project_summary", must_not_generate)

    as_user(BOB)
    discord_body = {"guildId": "1", "channelId": "2"}
    responses = [
        anon_client.get(f"/api/projects/{project_id}"),
        anon_client.get(f"/api/projects/{project_id}/dashboard"),
        anon_client.patch(f"/api/projects/{project_id}", json={"name": "Hijacked"}),
        anon_client.post(f"/api/projects/{project_id}/summaries"),
        anon_client.post(f"/api/projects/{project_id}/integrations/discord", json=discord_body),
        anon_client.post(f"/api/projects/{project_id}/integrations/discord/sync"),
    ]

    for response in responses:
        assert response.status_code == 404, response.request.url
        assert response.json()["detail"]["code"] == "not_found"


def test_not_found_looks_the_same_for_missing_and_inaccessible_projects(
    anon_client: TestClient, as_user: AsUser
) -> None:
    as_user(ALICE)
    project_id = _create(anon_client)
    as_user(BOB)

    inaccessible = anon_client.get(f"/api/projects/{project_id}")
    missing = anon_client.get(f"/api/projects/{MISSING}")

    assert inaccessible.status_code == missing.status_code == 404
    assert inaccessible.json() == missing.json()


def test_a_blocked_edit_leaves_the_project_unchanged(
    anon_client: TestClient, as_user: AsUser
) -> None:
    as_user(ALICE)
    project_id = _create(anon_client, "Original")
    as_user(BOB)
    anon_client.patch(f"/api/projects/{project_id}", json={"name": "Hijacked"})

    as_user(ALICE)
    assert anon_client.get(f"/api/projects/{project_id}").json()["name"] == "Original"


def test_members_can_read_and_edit_the_project(
    anon_client: TestClient, as_user: AsUser, db_session: Session
) -> None:
    as_user(ALICE)
    project_id = _create(anon_client)
    db_session.add(
        ProjectMember(project_id=uuid.UUID(project_id), user_id=BOB, role=ProjectRole.MEMBER)
    )
    db_session.commit()

    as_user(BOB)
    assert anon_client.get(f"/api/projects/{project_id}").status_code == 200
    assert anon_client.get(f"/api/projects/{project_id}/dashboard").status_code == 200
    renamed = anon_client.patch(f"/api/projects/{project_id}", json={"name": "Renamed"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Renamed"


def test_deleting_a_project_removes_its_memberships(
    anon_client: TestClient, as_user: AsUser, db_session: Session
) -> None:
    from app.models.project import Project

    as_user(ALICE)
    project_id = uuid.UUID(_create(anon_client))

    db_session.delete(db_session.get(Project, project_id))
    db_session.commit()

    assert db_session.scalars(select(ProjectMember)).all() == []


def test_project_routes_still_require_authentication(anon_client: TestClient) -> None:
    assert anon_client.get("/api/projects").status_code == 401
    assert anon_client.post("/api/projects", json=_payload()).status_code == 401
    assert anon_client.get(f"/api/projects/{MISSING}").status_code == 401
