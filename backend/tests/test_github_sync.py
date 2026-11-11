"""Service tests for `app.integrations.github_sync`.

GitHub is faked at the client-function boundary; `test_github_client.py`
covers the HTTP layer.
"""

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations import github_sync
from app.integrations.github import GitHubRepository
from app.integrations.github_sync import (
    GitHubInstallationForbidden,
    GitHubNotConnected,
    GitHubRepositoryNotInInstallation,
    ProjectNotFound,
    connect_github,
    list_repositories,
    select_repository,
)
from app.models.activity import ActivityItem
from app.models.enums import IntegrationProvider, IntegrationState
from app.models.project import Project

INSTALLATION_ID = 42


def _repo(repo_id: int, name: str) -> GitHubRepository:
    return GitHubRepository(
        id=repo_id,
        owner="ada",
        name=name,
        full_name=f"ada/{name}",
        default_branch="main",
        html_url=f"https://github.com/ada/{name}",
        private=True,
    )


API = _repo(1, "api")
WEB = _repo(2, "web")


@pytest.fixture
def project(db_session: Session) -> Project:
    project = Project(name="Campus Cart", summary="Textbook marketplace.")
    db_session.add(project)
    db_session.commit()
    return project


@pytest.fixture
def github(monkeypatch: pytest.MonkeyPatch) -> dict:
    """Fake GitHub: tests change `repositories` or `can_access` as needed."""
    fake = {"repositories": [API], "can_access": True}
    monkeypatch.setattr(github_sync, "exchange_user_code", lambda code, client=None: "user-token")
    monkeypatch.setattr(
        github_sync,
        "user_can_access_installation",
        lambda token, installation_id, client=None: fake["can_access"],
    )
    monkeypatch.setattr(
        github_sync,
        "list_installation_repositories",
        lambda installation_id, client=None: fake["repositories"],
    )
    return fake


def _connect(db: Session, project: Project, **kwargs):
    return connect_github(
        db, project.id, installation_id=INSTALLATION_ID, authorization_code="code", **kwargs
    )


def _add_github_activity(db: Session, project: Project) -> None:
    db.add(
        ActivityItem(
            project_id=project.id,
            source=IntegrationProvider.GITHUB,
            source_id="C_1",
            kind="commit",
            occurred_at=datetime(2026, 11, 1, tzinfo=UTC),
            title="feat: add listings",
        )
    )
    db.commit()


def test_connect_auto_selects_the_only_repository(db_session, project, github):
    """UC2-AC1: one granted repository is associated with the project."""
    integration, repositories = _connect(db_session, project)

    assert repositories == [API]
    assert integration.provider == IntegrationProvider.GITHUB
    assert integration.status == IntegrationState.CONNECTED
    assert integration.config == {
        "installation_id": INSTALLATION_ID,
        "repository": API.model_dump(),
    }


def test_connect_with_several_repositories_waits_for_a_choice(db_session, project, github):
    github["repositories"] = [API, WEB]

    integration, repositories = _connect(db_session, project)

    assert repositories == [API, WEB]
    assert integration.config["repository"] is None


def test_connect_selects_the_requested_repository(db_session, project, github):
    github["repositories"] = [API, WEB]

    integration, _ = _connect(db_session, project, repository_owner="Ada", repository_name="WEB")

    assert integration.config["repository"]["id"] == WEB.id


def test_reconnect_keeps_the_selected_repository_and_its_activity(db_session, project, github):
    github["repositories"] = [API, WEB]
    _connect(db_session, project, repository_owner="ada", repository_name="web")
    _add_github_activity(db_session, project)

    integration, _ = _connect(db_session, project)

    assert integration.config["repository"]["id"] == WEB.id
    assert db_session.scalars(select(ActivityItem)).all() != []


def test_connect_rejects_installation_user_cannot_access(db_session, project, github):
    """DEC-3: a guessed installation id is not enough to attach a repository."""
    github["can_access"] = False

    with pytest.raises(GitHubInstallationForbidden):
        _connect(db_session, project)


def test_connect_rejects_repository_outside_installation(db_session, project, github):
    with pytest.raises(GitHubRepositoryNotInInstallation):
        _connect(db_session, project, repository_owner="ada", repository_name="secret")


def test_connect_unknown_project(db_session, github):
    with pytest.raises(ProjectNotFound):
        connect_github(db_session, uuid.uuid4(), installation_id=1, authorization_code="code")


def test_list_and_select_require_a_connection(db_session, project, github):
    with pytest.raises(GitHubNotConnected):
        list_repositories(db_session, project.id)
    with pytest.raises(GitHubNotConnected):
        select_repository(db_session, project.id, owner="ada", name="api")


def test_list_repositories_returns_the_installation_repositories(db_session, project, github):
    github["repositories"] = [API, WEB]
    _connect(db_session, project)

    assert list_repositories(db_session, project.id) == [API, WEB]


def test_select_repository_outside_installation(db_session, project, github):
    _connect(db_session, project)

    with pytest.raises(GitHubRepositoryNotInInstallation):
        select_repository(db_session, project.id, owner="ada", name="secret")


def test_changing_repository_clears_previous_github_activity(db_session, project, github):
    """OPEN-3: activity from the old repository is not shown as the new one's."""
    github["repositories"] = [API, WEB]
    integration, _ = _connect(db_session, project, repository_owner="ada", repository_name="api")
    integration.last_successful_sync_at = datetime(2026, 11, 1, tzinfo=UTC)
    _add_github_activity(db_session, project)

    integration = select_repository(db_session, project.id, owner="ada", name="web")

    assert integration.config["repository"]["id"] == WEB.id
    assert integration.last_successful_sync_at is None
    assert db_session.scalars(select(ActivityItem)).all() == []


def test_reselecting_the_same_repository_keeps_activity(db_session, project, github):
    _connect(db_session, project)
    _add_github_activity(db_session, project)

    select_repository(db_session, project.id, owner="ada", name="api")

    assert len(db_session.scalars(select(ActivityItem)).all()) == 1
