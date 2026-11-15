"""API tests for the GitHub integration (UC2).

GitHub is a fake HTTP server (`httpx.MockTransport`), so pagination and error
mapping run through the real client. Only token minting and the install-code
exchange are stubbed, because they need the app's private key.
"""

import uuid
from datetime import UTC, datetime

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.integrations.github import GitHubError
from app.models.activity import ActivityItem
from app.models.enums import IntegrationProvider, IntegrationState
from app.models.project import Project

API = "https://api.github.com"


def _raw_repo(repo_id: int, name: str) -> dict:
    return {
        "id": repo_id,
        "name": name,
        "full_name": f"ada/{name}",
        "owner": {"login": "ada"},
        "default_branch": "main",
        "html_url": f"https://github.com/ada/{name}",
        "private": True,
    }


def _raw_commit(node_id: str, message: str = "feat: add listings") -> dict:
    return {
        "node_id": node_id,
        "sha": f"sha-{node_id}",
        "html_url": f"https://github.com/ada/api/commit/sha-{node_id}",
        "author": {"login": "ada"},
        "parents": [{"sha": "parent"}],
        "commit": {
            "message": message,
            "author": {"name": "Ada", "date": "2026-11-09T15:00:00Z"},
            "committer": {"name": "Ada", "date": "2026-11-09T15:00:00Z"},
        },
    }


def _raw_pull(state: str = "open", merged: bool = False) -> dict:
    return {
        "node_id": "PR_7",
        "number": 7,
        "title": "Add listing search",
        "body": "Closes #3",
        "state": state,
        "draft": False,
        "user": {"login": "grace"},
        "created_at": "2026-11-08T09:00:00Z",
        # Recent enough to stay inside the 90-day backfill window.
        "updated_at": "2099-01-01T00:00:00Z",
        "merged_at": "2026-11-09T18:00:00Z" if merged else None,
        "closed_at": "2026-11-09T18:00:00Z" if state == "closed" else None,
        "head": {"ref": "feature/search"},
        "base": {"ref": "main"},
        "labels": [{"name": "frontend"}],
        "requested_reviewers": [{"login": "linus"}],
        "html_url": "https://github.com/ada/api/pull/7",
    }


def _paged(request: httpx.Request, pages: list[list[dict]]) -> httpx.Response:
    """Serve `pages` with `Link: rel="next"` headers, the way GitHub does."""
    page = int(request.url.params.get("page", "1"))
    headers = {}
    if page < len(pages):
        headers["Link"] = f'<{request.url.copy_set_param("page", page + 1)}>; rel="next"'
    return httpx.Response(200, json=pages[page - 1], headers=headers)


@pytest.fixture
def github(monkeypatch: pytest.MonkeyPatch) -> dict:
    """Fake GitHub. Tests edit the dict; `error` replaces repository responses."""
    fake = {
        "installation_ids": [42],
        "repositories": [_raw_repo(1, "api")],
        "commits": [[_raw_commit("C_1")]],
        "pulls": [[_raw_pull()]],
        "error": None,
    }

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/user/installations":
            return httpx.Response(
                200, json={"installations": [{"id": i} for i in fake["installation_ids"]]}
            )
        if path == "/installation/repositories":
            return httpx.Response(200, json={"repositories": fake["repositories"]})
        if fake["error"] is not None:
            return fake["error"]
        if path == "/repos/ada/api/commits":
            return _paged(request, fake["commits"])
        if path == "/repos/ada/api/pulls":
            return _paged(request, fake["pulls"])
        return httpx.Response(404)

    real_client = httpx.Client
    monkeypatch.setattr(
        "app.integrations.github.httpx.Client",
        lambda *args, **kwargs: real_client(transport=httpx.MockTransport(handler)),
    )
    monkeypatch.setattr("app.integrations.github.get_installation_token", _fake_token)
    monkeypatch.setattr("app.integrations.github_sync.get_installation_token", _fake_token)
    monkeypatch.setattr(
        "app.integrations.github_sync.exchange_user_code", lambda code, client=None: "user-token"
    )
    monkeypatch.setattr(settings, "github_api_url", API)
    monkeypatch.setattr(settings, "github_app_slug", "devsync-test")
    monkeypatch.setattr(settings, "github_max_pages", 10)
    return fake


def _fake_token(installation_id, *, repository_ids=None, client=None) -> str:
    return "ghs_test"


def _create_project(client: TestClient) -> str:
    res = client.post(
        "/api/projects",
        json={
            "name": "Campus Cart",
            "summary": "Textbook marketplace.",
            "features": ["Listings"],
            "milestones": [{"title": "Plan approved", "dueAt": "2026-12-01T00:00:00Z"}],
        },
    )
    assert res.status_code == 201
    return res.json()["id"]


def _connect(client: TestClient, project_id: str, **body) -> httpx.Response:
    return client.post(
        f"/api/projects/{project_id}/integrations/github",
        json={"installationId": 42, "authorizationCode": "code", **body},
    )


def _sync(client: TestClient, project_id: str) -> httpx.Response:
    return client.post(f"/api/projects/{project_id}/integrations/github/sync")


def _activity(db: Session) -> dict[str, ActivityItem]:
    return {item.source_id: item for item in db.scalars(select(ActivityItem))}


def test_connects_account_and_selects_an_accessible_repository(client, github):
    """UC2-AC1: allow a project to select a repository visible to its GitHub connection."""
    project_id = _create_project(client)

    res = _connect(client, project_id)

    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "github"
    assert body["status"] == "connected"
    assert body["repository"]["fullName"] == "ada/api"
    assert [repo["fullName"] for repo in body["repositories"]] == ["ada/api"]

    # With several repositories the user picks one.
    github["repositories"] = [_raw_repo(1, "api"), _raw_repo(2, "web")]
    other_id = _create_project(client)
    assert _connect(client, other_id).json()["repository"] is None

    repos = client.get(f"/api/projects/{other_id}/integrations/github/repositories")
    assert [repo["name"] for repo in repos.json()] == ["api", "web"]

    res = client.put(
        f"/api/projects/{other_id}/integrations/github/repository",
        json={"repositoryOwner": "ada", "repositoryName": "web"},
    )
    assert res.status_code == 200
    assert res.json()["repository"]["fullName"] == "ada/web"
    status = client.get(f"/api/projects/{other_id}/integrations/github").json()
    assert status["repository"]["fullName"] == "ada/web"


def test_imports_commits_and_pull_requests_for_the_selected_repository(client, github, db_session):
    """UC2-AC2, UC2-AC4: normalize the GitHub activity used to monitor project progress."""
    project_id = _create_project(client)
    _connect(client, project_id)

    res = _sync(client, project_id)

    assert res.status_code == 200
    assert res.json() == {"provider": "github", "status": "healthy", "importedCount": 2}
    assert {item.kind for item in _activity(db_session).values()} == {"commit", "pull_request"}
    status = client.get(f"/api/projects/{project_id}/integrations/github").json()
    assert status["lastSuccessfulSyncAt"] is not None
    assert status["lastSyncError"] is None


def test_import_preserves_github_activity_fields(client, github, db_session):
    """Preserve source ID, repository, author, timestamp, URL, status, and content."""
    github["pulls"] = [[_raw_pull(state="closed", merged=True)]]
    project_id = _create_project(client)
    _connect(client, project_id)
    _sync(client, project_id)

    pull = _activity(db_session)["PR_7"]

    assert str(pull.project_id) == project_id
    assert pull.url == "https://github.com/ada/api/pull/7"
    assert pull.occurred_at.isoformat() == "2099-01-01T00:00:00+00:00"
    assert pull.details["repository"] == "ada/api"
    assert pull.details["author_login"] == "grace"
    assert pull.details["state"] == "merged"
    assert pull.details["body"] == "Closes #3"
    assert pull.details["labels"] == ["frontend"]
    assert pull.details["requested_reviewers"] == ["linus"]


def test_repeated_sync_does_not_create_duplicate_activity(client, github, db_session):
    """UC2-AC3: make synchronization idempotent by GitHub resource ID."""
    project_id = _create_project(client)
    _connect(client, project_id)

    _sync(client, project_id)
    _sync(client, project_id)

    assert sorted(_activity(db_session)) == ["C_1", "PR_7"]


def test_sync_updates_pull_request_status_and_metadata(client, github, db_session):
    """UC2-AC3: reflect later merge, close, and reopen changes."""
    project_id = _create_project(client)
    _connect(client, project_id)

    for pull, expected in [
        (_raw_pull(), "open"),
        (_raw_pull(state="closed"), "closed"),
        (_raw_pull(), "open"),
        (_raw_pull(state="closed", merged=True), "merged"),
    ]:
        github["pulls"] = [[pull]]
        _sync(client, project_id)
        db_session.expire_all()
        assert _activity(db_session)["PR_7"].details["state"] == expected

    assert len(_activity(db_session)) == 2


def test_sync_imports_multiple_pages_of_activity(client, github, db_session):
    """Follow GitHub pagination without skipping or repeating records."""
    github["commits"] = [[_raw_commit(f"C_{page}_{i}") for i in range(2)] for page in range(3)]
    github["pulls"] = [[]]
    project_id = _create_project(client)
    _connect(client, project_id)

    assert _sync(client, project_id).json()["importedCount"] == 6
    assert len(_activity(db_session)) == 6


def test_sync_failure_preserves_previously_imported_activity(client, github, db_session):
    """UC2-AC5: handle unavailable, rate-limited, or revoked access without losing data."""
    project_id = _create_project(client)
    _connect(client, project_id)
    _sync(client, project_id)
    last_success = client.get(f"/api/projects/{project_id}/integrations/github").json()[
        "lastSuccessfulSyncAt"
    ]

    for error, code, state in [
        (
            httpx.Response(403, headers={"x-ratelimit-remaining": "0", "retry-after": "60"}),
            "rate_limited",
            IntegrationState.STALE,
        ),
        (httpx.Response(503), "github_unavailable", IntegrationState.STALE),
        (httpx.Response(401), "github_access_revoked", IntegrationState.FAILED),
    ]:
        github["error"] = error
        res = _sync(client, project_id)

        assert res.status_code == 502
        assert res.json()["detail"]["code"] == code
        status = client.get(f"/api/projects/{project_id}/integrations/github").json()
        assert status["status"] == state
        assert status["lastSyncError"]
        assert status["lastSuccessfulSyncAt"] == last_success
        assert sorted(_activity(db_session)) == ["C_1", "PR_7"]


def test_rate_limited_sync_reports_retry_after(client, github):
    project_id = _create_project(client)
    _connect(client, project_id)
    github["error"] = httpx.Response(429, headers={"retry-after": "60"})

    assert _sync(client, project_id).json()["detail"]["retryAfter"] == 60


def test_connect_rejects_installation_user_cannot_access(client, github):
    """DEC-3: a guessed installation id is refused."""
    github["installation_ids"] = [99]
    project_id = _create_project(client)

    res = _connect(client, project_id)

    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "installation_forbidden"


def test_connect_rejects_an_expired_authorization_code(client, github, monkeypatch):
    def expired(code, client=None):
        raise GitHubError(
            400, "expired", code="authorization_failed", state=IntegrationState.FAILED
        )

    monkeypatch.setattr("app.integrations.github_sync.exchange_user_code", expired)
    project_id = _create_project(client)

    res = _connect(client, project_id)

    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "authorization_failed"


def test_select_rejects_repository_outside_installation(client, github):
    project_id = _create_project(client)
    _connect(client, project_id)

    res = client.put(
        f"/api/projects/{project_id}/integrations/github/repository",
        json={"repositoryOwner": "ada", "repositoryName": "secret"},
    )

    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "repository_not_in_installation"


def test_sync_before_connect_returns_409(client, github):
    project_id = _create_project(client)

    for res in [
        _sync(client, project_id),
        client.get(f"/api/projects/{project_id}/integrations/github"),
    ]:
        assert res.status_code == 409
        assert res.json()["detail"]["code"] == "not_connected"


def test_sync_before_repository_selected_returns_409(client, github):
    github["repositories"] = [_raw_repo(1, "api"), _raw_repo(2, "web")]
    project_id = _create_project(client)
    _connect(client, project_id)

    res = _sync(client, project_id)

    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "repository_not_selected"


def test_unknown_project_returns_404(client, github, db_session):
    """Missing projects and other teams' projects look the same."""
    other = Project(name="Not mine", summary="Someone else's project.")
    db_session.add(other)
    db_session.commit()

    for project_id in [uuid.uuid4(), other.id]:
        base = f"/api/projects/{project_id}/integrations/github"
        responses = [
            client.get(f"/api/github/install-url?projectId={project_id}"),
            _connect(client, str(project_id)),
            client.get(base),
            client.get(f"{base}/repositories"),
            client.post(f"{base}/sync"),
            client.delete(base),
        ]
        assert [res.status_code for res in responses] == [404] * 6


def test_disconnect_deletes_only_this_projects_github_data(client, github, db_session):
    """Spec §7 deletion behavior: other projects and Discord activity are kept."""
    project_id = _create_project(client)
    other_id = _create_project(client)
    for pid in [project_id, other_id]:
        _connect(client, pid)
        _sync(client, pid)
    db_session.add(
        ActivityItem(
            project_id=uuid.UUID(project_id),
            source=IntegrationProvider.DISCORD,
            source_id="msg-1",
            kind="message",
            occurred_at=datetime(2026, 11, 9, tzinfo=UTC),
            title="Standup notes",
        )
    )
    db_session.commit()

    res = client.delete(f"/api/projects/{project_id}/integrations/github")

    assert res.status_code == 204
    assert res.content == b""
    assert client.get(f"/api/projects/{project_id}/integrations/github").status_code == 409
    remaining = db_session.scalars(select(ActivityItem)).all()
    assert sorted((str(item.project_id), item.source) for item in remaining) == sorted(
        [(project_id, "discord"), (other_id, "github"), (other_id, "github")]
    )
    # Disconnecting again is harmless.
    assert client.delete(f"/api/projects/{project_id}/integrations/github").status_code == 204


def test_install_url_contains_slug_and_state(client, github):
    project_id = _create_project(client)

    res = client.get(f"/api/github/install-url?projectId={project_id}")

    assert res.status_code == 200
    assert res.json()["url"] == (
        f"https://github.com/apps/devsync-test/installations/new?state={project_id}"
    )


def test_missing_app_config_returns_500(client, github, monkeypatch):
    monkeypatch.setattr(settings, "github_app_slug", "")
    project_id = _create_project(client)

    res = client.get(f"/api/github/install-url?projectId={project_id}")

    assert res.status_code == 500
    assert res.json()["detail"]["code"] == "config_error"


def test_github_routes_require_sign_in(anon_client):
    assert anon_client.get(f"/api/github/install-url?projectId={uuid.uuid4()}").status_code == 401
