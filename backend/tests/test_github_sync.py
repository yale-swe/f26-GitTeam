"""Service tests for `app.integrations.github_sync`.

GitHub is faked at the client-function boundary; `test_github_client.py`
covers the HTTP layer.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations import github_sync
from app.integrations.github import (
    GitHubCommit,
    GitHubError,
    GitHubPullRequest,
    GitHubRepository,
)
from app.integrations.github_sync import (
    GitHubInstallationForbidden,
    GitHubNotConnected,
    GitHubRepositoryNotInInstallation,
    GitHubRepositoryNotSelected,
    ProjectNotFound,
    connect_github,
    list_repositories,
    select_repository,
    sync_github,
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
    """Fake GitHub. Tests edit the dict to change what it returns.

    `error` makes the token request fail; `calls` records sync requests.
    """
    fake = {
        "repositories": [API],
        "can_access": True,
        "commits": [],
        "pulls": [],
        "error": None,
        "calls": [],
    }

    def get_installation_token(installation_id, *, repository_ids=None, client=None):
        if fake["error"]:
            raise fake["error"]
        fake["calls"].append(("token", installation_id, repository_ids))
        return "installation-token"

    def list_commits(owner, name, *, branch, since, token, client=None):
        fake["calls"].append(("commits", f"{owner}/{name}", branch, since))
        return fake["commits"]

    def list_pull_requests(owner, name, *, updated_since, token, client=None):
        fake["calls"].append(("pulls", f"{owner}/{name}", updated_since))
        return fake["pulls"]

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
    monkeypatch.setattr(github_sync, "get_installation_token", get_installation_token)
    monkeypatch.setattr(github_sync, "list_commits", list_commits)
    monkeypatch.setattr(github_sync, "list_pull_requests", list_pull_requests)
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


# --- Sync ---------------------------------------------------------------------

NOW = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)


def _commit(
    node_id: str = "C_1", message: str = "feat: add listings\n\nWith photos."
) -> GitHubCommit:
    return GitHubCommit(
        node_id=node_id,
        sha="abc1234def",
        message=message,
        author_login="ada",
        author_name="Ada",
        committed_at=datetime(2026, 11, 9, 15, 0, tzinfo=UTC),
        html_url="https://github.com/ada/api/commit/abc1234def",
        is_merge=False,
    )


def _pull(state: str = "open", title: str = "Add listing search") -> GitHubPullRequest:
    merged_at = datetime(2026, 11, 9, 18, 0, tzinfo=UTC) if state == "merged" else None
    return GitHubPullRequest(
        node_id="PR_7",
        number=7,
        title=title,
        body="Closes #3",
        state=state,
        draft=False,
        author_login="ada",
        created_at=datetime(2026, 11, 8, 9, 0, tzinfo=UTC),
        updated_at=merged_at or datetime(2026, 11, 9, 10, 0, tzinfo=UTC),
        merged_at=merged_at,
        closed_at=merged_at,
        head_ref="feature/search",
        base_ref="main",
        labels=["frontend"],
        requested_reviewers=["grace"],
        html_url="https://github.com/ada/api/pull/7",
    )


def _activity(db: Session) -> dict[str, ActivityItem]:
    return {item.source_id: item for item in db.scalars(select(ActivityItem))}


def test_imports_commits_and_pull_requests_for_the_selected_repository(db_session, project, github):
    """UC2-AC2, UC2-AC4: a successful sync stores activity and records the time."""
    _connect(db_session, project)
    github["commits"] = [_commit()]
    github["pulls"] = [_pull()]

    integration, imported = sync_github(db_session, project.id, now=NOW)

    assert imported == 2
    assert integration.status == IntegrationState.HEALTHY
    assert integration.last_successful_sync_at == NOW
    assert integration.last_sync_error is None
    assert {item.kind for item in _activity(db_session).values()} == {"commit", "pull_request"}


def test_import_preserves_github_activity_fields(db_session, project, github):
    """Rows follow the GitHub activity contract that health and summaries read."""
    _connect(db_session, project)
    github["commits"] = [_commit()]
    github["pulls"] = [_pull()]

    sync_github(db_session, project.id, now=NOW)
    activity = _activity(db_session)

    commit = activity["C_1"]
    assert commit.title == "feat: add listings"
    assert commit.url == "https://github.com/ada/api/commit/abc1234def"
    assert commit.occurred_at == datetime(2026, 11, 9, 15, 0, tzinfo=UTC)
    assert commit.details == {
        "repository": "ada/api",
        "sha": "abc1234def",
        "branch": "main",
        "author_login": "ada",
        "author_name": "Ada",
        "message": "feat: add listings\n\nWith photos.",
        "is_merge": False,
    }

    pull = activity["PR_7"]
    assert pull.title == "Add listing search"
    assert pull.occurred_at == datetime(2026, 11, 9, 10, 0, tzinfo=UTC)
    assert pull.details == {
        "repository": "ada/api",
        "number": 7,
        "state": "open",
        "draft": False,
        "author_login": "ada",
        "created_at": "2026-11-08T09:00:00+00:00",
        "updated_at": "2026-11-09T10:00:00+00:00",
        "merged_at": None,
        "closed_at": None,
        "head_ref": "feature/search",
        "base_ref": "main",
        "labels": ["frontend"],
        "requested_reviewers": ["grace"],
        "body": "Closes #3",
    }


def test_sync_updates_pull_request_status_and_metadata(db_session, project, github):
    """UC2-AC3: a PR merged after the first sync updates the same row."""
    _connect(db_session, project)
    github["pulls"] = [_pull()]
    sync_github(db_session, project.id, now=NOW)

    github["pulls"] = [_pull(state="merged", title="Add listing search (v2)")]
    sync_github(db_session, project.id, now=NOW + timedelta(hours=1))

    activity = _activity(db_session)
    assert list(activity) == ["PR_7"]
    assert activity["PR_7"].title == "Add listing search (v2)"
    assert activity["PR_7"].details["state"] == "merged"


def test_sync_ignores_an_item_returned_twice(db_session, project, github):
    _connect(db_session, project)
    github["commits"] = [_commit(), _commit()]

    _, imported = sync_github(db_session, project.id, now=NOW)

    assert imported == 1
    assert len(_activity(db_session)) == 1


def test_long_commit_titles_are_truncated(db_session, project, github):
    _connect(db_session, project)
    github["commits"] = [_commit(message="x" * 300), _commit("C_2", message="")]

    sync_github(db_session, project.id, now=NOW)
    activity = _activity(db_session)

    assert len(activity["C_1"].title) == 240
    assert activity["C_1"].title.endswith("…")
    assert activity["C_2"].title == "Commit abc1234"


@pytest.mark.parametrize(
    ("error", "state"),
    [
        (
            GitHubError(
                403, "GitHub rate limit reached", code="rate_limited", state=IntegrationState.STALE
            ),
            IntegrationState.STALE,
        ),
        (
            GitHubError(
                401,
                "GitHub access was revoked",
                code="github_access_revoked",
                state=IntegrationState.FAILED,
            ),
            IntegrationState.FAILED,
        ),
    ],
)
def test_sync_failure_preserves_previously_imported_activity(
    db_session, project, github, error, state
):
    """UC2-AC5: keep old data, mark stale or failed, and leave the last success alone."""
    _connect(db_session, project)
    github["commits"] = [_commit()]
    sync_github(db_session, project.id, now=NOW)

    github["error"] = error
    with pytest.raises(GitHubError):
        sync_github(db_session, project.id, now=NOW + timedelta(hours=1))

    integration = github_sync._github_integration(db_session, project.id)
    assert integration.status == state
    assert integration.last_sync_error == error.message
    assert integration.last_successful_sync_at == NOW
    assert list(_activity(db_session)) == ["C_1"]


def test_second_sync_requests_since_last_success_minus_overlap(db_session, project, github):
    """DEC-8: backfill 90 days first, then overlap the last success by 72 hours."""
    _connect(db_session, project)
    sync_github(db_session, project.id, now=NOW)
    sync_github(db_session, project.id, now=NOW + timedelta(days=1))

    first, second = github["calls"][:3], github["calls"][3:]
    assert first == [
        ("token", INSTALLATION_ID, [API.id]),
        ("commits", "ada/api", "main", NOW - timedelta(days=90)),
        ("pulls", "ada/api", NOW - timedelta(days=90)),
    ]
    assert second[1:] == [
        ("commits", "ada/api", "main", NOW - timedelta(hours=72)),
        ("pulls", "ada/api", NOW - timedelta(hours=72)),
    ]


def test_sync_requires_a_connection_and_a_selected_repository(db_session, project, github):
    with pytest.raises(GitHubNotConnected):
        sync_github(db_session, project.id)

    github["repositories"] = [API, WEB]
    _connect(db_session, project)
    with pytest.raises(GitHubRepositoryNotSelected):
        sync_github(db_session, project.id)
