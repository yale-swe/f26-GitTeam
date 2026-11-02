"""Unit tests for the GitHub REST client (no database writes, no real network)."""

import json
import time
from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
)

from app.config import settings
from app.integrations import github
from app.integrations.github import (
    GitHubConfigError,
    GitHubError,
    exchange_user_code,
    get_installation_token,
    install_url,
    list_commits,
    list_installation_repositories,
    list_pull_requests,
    user_can_access_installation,
)
from app.models.enums import IntegrationState

API = "https://api.github.com"
SINCE = datetime(2026, 10, 1, tzinfo=UTC)
Handler = Callable[[httpx.Request], httpx.Response]


@pytest.fixture(scope="module")
def private_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def app_config(monkeypatch: pytest.MonkeyPatch, private_key: rsa.RSAPrivateKey) -> Iterator[None]:
    pem = private_key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()).decode()
    monkeypatch.setattr(settings, "github_app_client_id", "Iv1.test-client")
    monkeypatch.setattr(settings, "github_app_client_secret", "test-client-secret")
    monkeypatch.setattr(settings, "github_app_private_key", pem)
    monkeypatch.setattr(settings, "github_app_slug", "devsync-test")
    monkeypatch.setattr(settings, "github_api_url", API)
    monkeypatch.setattr(settings, "github_max_pages", 10)
    github.clear_token_cache()
    yield
    github.clear_token_cache()


def _client(handler: Handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def _token_response(token: str = "ghs_installation", minutes: int = 60) -> httpx.Response:
    expires = (datetime.now(UTC) + timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return httpx.Response(201, json={"token": token, "expires_at": expires})


def _next_link(url: str) -> dict[str, str]:
    return {"Link": f'<{url}>; rel="next"'}


def _repo(repo_id: int, name: str) -> dict:
    return {
        "id": repo_id,
        "name": name,
        "full_name": f"ada/{name}",
        "owner": {"login": "ada"},
        "default_branch": "main",
        "html_url": f"https://github.com/ada/{name}",
        "private": True,
    }


def _commit(sha: str, *, message: str = "feat: add a", parents: int = 1, author: bool = True):
    return {
        "sha": sha,
        "node_id": f"C_{sha}",
        "html_url": f"https://github.com/ada/sandbox/commit/{sha}",
        "commit": {
            "message": message,
            "author": {"name": "Ada", "date": "2026-10-20T10:00:00Z"},
            "committer": {"name": "GitHub", "date": "2026-10-20T10:05:00Z"},
        },
        "author": {"login": "ada"} if author else None,
        "parents": [{"sha": f"p{i}"} for i in range(parents)],
    }


def _pull(number: int, *, updated: str, state: str = "open", merged_at: str | None = None):
    return {
        "node_id": f"PR_{number}",
        "number": number,
        "title": f"PR {number}",
        "body": "Closes #1",
        "state": state,
        "draft": False,
        "user": {"login": "ada"},
        "created_at": "2026-10-10T09:00:00Z",
        "updated_at": updated,
        "merged_at": merged_at,
        "closed_at": merged_at,
        "head": {"ref": f"feature/{number}"},
        "base": {"ref": "main"},
        "labels": [{"name": "backend"}],
        "requested_reviewers": [{"login": "grace"}],
        "html_url": f"https://github.com/ada/sandbox/pull/{number}",
    }


# --- App authentication -------------------------------------------------------


def test_app_jwt_is_rs256_signed_with_the_client_id(private_key: rsa.RSAPrivateKey):
    token = github._app_jwt()
    claims = jwt.decode(token, private_key.public_key(), algorithms=["RS256"])
    assert claims["iss"] == "Iv1.test-client"
    assert claims["iat"] <= int(time.time()) - 59
    assert claims["exp"] - claims["iat"] == 600


def test_private_key_with_escaped_newlines_is_accepted(monkeypatch: pytest.MonkeyPatch):
    one_line = settings.github_app_private_key.strip().replace("\n", "\\n")
    monkeypatch.setattr(settings, "github_app_private_key", one_line)
    assert github._app_jwt().count(".") == 2


def test_missing_app_credentials_raise_config_error(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "github_app_private_key", "")
    with pytest.raises(GitHubConfigError):
        get_installation_token(1, client=_client(lambda request: _token_response()))


def test_invalid_private_key_raises_config_error(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "github_app_private_key", "not a pem")
    with pytest.raises(GitHubConfigError, match="not a valid RSA private key"):
        github._app_jwt()


def test_install_url_contains_slug_and_state():
    url = urlparse(install_url("project-123"))
    assert url.netloc == "github.com"
    assert url.path == "/apps/devsync-test/installations/new"
    assert parse_qs(url.query) == {"state": ["project-123"]}


def test_install_url_requires_slug(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "github_app_slug", "")
    with pytest.raises(GitHubConfigError):
        install_url("project-123")


# --- Installation tokens ------------------------------------------------------


def test_installation_token_is_minted_with_app_jwt_and_cached():
    mints: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        mints.append(request)
        return _token_response()

    client = _client(handler)
    assert get_installation_token(42, client=client) == "ghs_installation"
    assert get_installation_token(42, client=client) == "ghs_installation"
    assert len(mints) == 1
    assert mints[0].method == "POST"
    assert mints[0].url.path == "/app/installations/42/access_tokens"
    assert mints[0].headers["Authorization"].startswith("Bearer ey")
    assert mints[0].headers["X-GitHub-Api-Version"] == github.GITHUB_API_VERSION


def test_installation_token_is_reminted_near_expiry():
    tokens = iter(["ghs_first", "ghs_second"])

    def handler(request: httpx.Request) -> httpx.Response:
        # Expires inside the refresh margin, so the next call must mint again.
        return _token_response(next(tokens), minutes=4)

    client = _client(handler)
    assert get_installation_token(42, client=client) == "ghs_first"
    assert get_installation_token(42, client=client) == "ghs_second"


def test_sync_token_is_scoped_to_one_repository_with_read_only_permissions():
    bodies: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content))
        return _token_response()

    get_installation_token(42, repository_ids=[987], client=_client(handler))
    assert bodies == [
        {
            "repository_ids": [987],
            "permissions": {"contents": "read", "pull_requests": "read", "metadata": "read"},
        }
    ]


def test_rejected_app_credentials_raise_config_error():
    client = _client(lambda request: httpx.Response(401, json={"message": "Bad credentials"}))
    with pytest.raises(GitHubConfigError, match="rejected the app credentials"):
        get_installation_token(42, client=client)


def test_uninstalled_app_is_reported_as_revoked_access():
    client = _client(lambda request: httpx.Response(404, json={"message": "Not Found"}))
    with pytest.raises(GitHubError) as caught:
        get_installation_token(42, client=client)
    assert caught.value.code == "github_access_revoked"
    assert caught.value.state == IntegrationState.FAILED


# --- User authorization (installation ownership) ------------------------------


def test_exchange_user_code_returns_the_user_token():
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == github.GITHUB_OAUTH_TOKEN_URL
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"access_token": "ghu_user", "token_type": "bearer"})

    assert exchange_user_code("code-1", client=_client(handler)) == "ghu_user"
    assert seen == [
        {"client_id": "Iv1.test-client", "client_secret": "test-client-secret", "code": "code-1"}
    ]


def test_exchange_rejects_used_or_expired_codes():
    client = _client(lambda request: httpx.Response(200, json={"error": "bad_verification_code"}))
    with pytest.raises(GitHubError) as caught:
        exchange_user_code("stale", client=client)
    assert caught.value.code == "authorization_failed"
    assert caught.value.status_code == 400


def test_user_can_access_installation_checks_every_page():
    page_two = f"{API}/user/installations?page=2"

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer ghu_user"
        if request.url.params.get("page") == "2":
            return httpx.Response(200, json={"installations": [{"id": 42}]})
        return httpx.Response(
            200, json={"installations": [{"id": 7}]}, headers=_next_link(page_two)
        )

    assert user_can_access_installation("ghu_user", 42, client=_client(handler)) is True
    assert user_can_access_installation("ghu_user", 99, client=_client(handler)) is False


# --- Pagination ---------------------------------------------------------------


def _repositories_handler(pages: int, requests: list[httpx.Request]) -> Handler:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/access_tokens"):
            return _token_response()
        requests.append(request)
        page = int(request.url.params.get("page", "1"))
        headers = _next_link(f"{API}/installation/repositories?per_page=100&page={page + 1}")
        return httpx.Response(
            200,
            json={"total_count": pages, "repositories": [_repo(page, f"repo-{page}")]},
            headers=headers if page < pages else {},
        )

    return handler


def test_list_installation_repositories_follows_every_page():
    requests: list[httpx.Request] = []
    repos = list_installation_repositories(42, client=_client(_repositories_handler(3, requests)))

    assert [repo.full_name for repo in repos] == ["ada/repo-1", "ada/repo-2", "ada/repo-3"]
    assert repos[0].owner == "ada" and repos[0].private is True
    assert requests[0].url.params["per_page"] == "100"
    assert [r.url.params.get("page") for r in requests] == [None, "2", "3"]
    assert all(r.headers["Authorization"] == "Bearer ghs_installation" for r in requests)


def test_pagination_stops_at_max_pages(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "github_max_pages", 2)
    requests: list[httpx.Request] = []
    repos = list_installation_repositories(42, client=_client(_repositories_handler(5, requests)))
    assert len(repos) == 2
    assert len(requests) == 2


def test_pagination_refuses_links_that_leave_the_api_host():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=[], headers=_next_link("https://evil.example/steal"))

    with pytest.raises(GitHubError) as caught:
        list_commits(
            "ada", "sandbox", branch="main", since=SINCE, token="t", client=_client(handler)
        )
    assert caught.value.code == "github_unavailable"
    assert [r.url.host for r in requests] == ["api.github.com"]


# --- Commits ------------------------------------------------------------------


def test_list_commits_requests_the_branch_since_a_time_and_normalizes():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json=[
                _commit("abc", message="feat: add a\n\nLonger body"),
                _commit("def", message="Merge pull request #2", parents=2, author=False),
            ],
        )

    commits = list_commits(
        "ada", "sandbox", branch="main", since=SINCE, token="ghs_x", client=_client(handler)
    )

    assert seen[0].url.path == "/repos/ada/sandbox/commits"
    assert seen[0].url.params["sha"] == "main"
    assert seen[0].url.params["since"] == "2026-10-01T00:00:00Z"
    first, merge = commits
    assert first.node_id == "C_abc" and first.sha == "abc"
    assert first.message == "feat: add a\n\nLonger body"
    assert first.author_login == "ada" and first.author_name == "Ada"
    assert first.committed_at == datetime(2026, 10, 20, 10, 5, tzinfo=UTC)
    assert first.is_merge is False
    assert merge.is_merge is True
    assert merge.author_login is None and merge.author_name == "Ada"


def test_empty_repository_has_no_commits():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"message": "Git Repository is empty."})

    client = _client(handler)
    assert list_commits("ada", "empty", branch="main", since=SINCE, token="t", client=client) == []


def test_repository_names_are_escaped_in_the_path():
    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url.raw_path.decode())
        return httpx.Response(200, json=[])

    list_commits("ada", "../x", branch="main", since=SINCE, token="t", client=_client(handler))
    assert seen[0].startswith("/repos/ada/..%2Fx/commits")


def test_malformed_commit_is_an_unexpected_response():
    client = _client(lambda request: httpx.Response(200, json=[{"sha": "abc"}]))
    with pytest.raises(GitHubError) as caught:
        list_commits("ada", "sandbox", branch="main", since=SINCE, token="t", client=client)
    assert caught.value.code == "github_unavailable"


# --- Pull requests ------------------------------------------------------------


def test_list_pull_requests_maps_states_and_stops_at_older_pages():
    requested_pages: list[str | None] = []
    page_two = f"{API}/repos/ada/sandbox/pulls?page=2"
    page_three = f"{API}/repos/ada/sandbox/pulls?page=3"

    def handler(request: httpx.Request) -> httpx.Response:
        page = request.url.params.get("page")
        requested_pages.append(page)
        if page is None:
            assert request.url.params["state"] == "all"
            assert request.url.params["sort"] == "updated"
            assert request.url.params["direction"] == "desc"
            pulls = [
                _pull(3, updated="2026-10-25T00:00:00Z", merged_at="2026-10-25T00:00:00Z"),
                _pull(2, updated="2026-10-20T00:00:00Z"),
            ]
            return httpx.Response(200, json=pulls, headers=_next_link(page_two))
        pulls = [
            _pull(1, updated="2026-10-05T00:00:00Z", state="closed"),
            _pull(0, updated="2026-09-01T00:00:00Z", state="closed"),
        ]
        return httpx.Response(200, json=pulls, headers=_next_link(page_three))

    pulls = list_pull_requests(
        "ada", "sandbox", updated_since=SINCE, token="t", client=_client(handler)
    )

    assert requested_pages == [None, "2"]  # page 3 is never fetched
    assert [(p.number, p.state) for p in pulls] == [(3, "merged"), (2, "open"), (1, "closed")]
    merged = pulls[0]
    assert merged.node_id == "PR_3" and merged.author_login == "ada"
    assert merged.merged_at == datetime(2026, 10, 25, tzinfo=UTC)
    assert merged.head_ref == "feature/3" and merged.base_ref == "main"
    assert merged.labels == ["backend"] and merged.requested_reviewers == ["grace"]
    assert merged.body == "Closes #1"


# --- Failure classification ---------------------------------------------------


def _commits_error(response: httpx.Response) -> GitHubError:
    client = _client(lambda request: response)
    with pytest.raises(GitHubError) as caught:
        list_commits("ada", "sandbox", branch="main", since=SINCE, token="t", client=client)
    return caught.value


def test_exhausted_rate_limit_is_stale_with_retry_after():
    reset = str(int(time.time()) + 120)
    exc = _commits_error(
        httpx.Response(
            403,
            json={"message": "API rate limit exceeded"},
            headers={"x-ratelimit-remaining": "0", "x-ratelimit-reset": reset},
        )
    )
    assert exc.code == "rate_limited"
    assert exc.state == IntegrationState.STALE
    assert exc.retry_after is not None and 100 <= exc.retry_after <= 120


def test_secondary_rate_limit_uses_retry_after_header():
    exc = _commits_error(httpx.Response(429, headers={"retry-after": "30"}))
    assert exc.code == "rate_limited"
    assert exc.retry_after == 30


@pytest.mark.parametrize("status", [401, 403, 404])
def test_lost_access_is_failed(status: int):
    exc = _commits_error(httpx.Response(status, json={"message": "nope"}))
    assert exc.code == "github_access_revoked"
    assert exc.state == IntegrationState.FAILED


def test_server_errors_are_stale():
    exc = _commits_error(httpx.Response(502, text="Bad gateway"))
    assert exc.code == "github_unavailable"
    assert exc.state == IntegrationState.STALE


def test_network_failure_is_stale():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused", request=request)

    with pytest.raises(GitHubError) as caught:
        list_commits(
            "ada", "sandbox", branch="main", since=SINCE, token="t", client=_client(handler)
        )
    assert caught.value.code == "github_unavailable"
    assert caught.value.state == IntegrationState.STALE


def test_non_json_response_is_unexpected():
    exc_client = _client(lambda request: httpx.Response(200, text="<html>"))
    with pytest.raises(GitHubError, match="unexpected response"):
        list_commits("ada", "sandbox", branch="main", since=SINCE, token="t", client=exc_client)


def test_errors_never_echo_tokens_or_response_bodies():
    secret = "ghs_supersecret"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": f"Bad credentials for {secret}"})

    with pytest.raises(GitHubError) as caught:
        list_commits(
            "ada", "sandbox", branch="main", since=SINCE, token=secret, client=_client(handler)
        )
    assert secret not in str(caught.value)
    assert secret not in repr(caught.value)
    assert secret not in caught.value.message
