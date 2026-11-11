"""GitHub REST client for the DevSync GitHub App.

The app's credentials live in server settings. Calls authenticate either as the
app (a JWT signed with its private key, valid for minutes) or as one
installation (a token GitHub issues for an hour). Installation tokens are
cached in memory only and never stored. Nothing in this module touches the
database; `github_sync.py` decides what to save.
"""

import time
from collections.abc import Callable, Collection, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote, urlencode

import httpx
import jwt
from pydantic import BaseModel

from app.config import settings
from app.models.enums import IntegrationState

GITHUB_API_VERSION = "2022-11-28"
GITHUB_OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token"
PAGE_SIZE = 100
# Sync tokens are limited to one repository and these read-only permissions.
SYNC_PERMISSIONS = {"contents": "read", "pull_requests": "read", "metadata": "read"}
# Mint a new installation token this long before GitHub expires the old one.
TOKEN_REFRESH_MARGIN = timedelta(minutes=5)


class GitHubConfigError(Exception):
    """Raised when the GitHub App credentials are missing or rejected."""


class GitHubError(Exception):
    """Raised when GitHub rejects a request or cannot be reached.

    `state` is what the project's integration should become: STALE when the
    failure is worth retrying later, FAILED when access has to be reconnected.
    Messages are fixed strings so tokens and response bodies never leak.
    """

    def __init__(
        self,
        status_code: int,
        message: str,
        *,
        code: str,
        state: IntegrationState,
        retry_after: int | None = None,
    ) -> None:
        self.status_code = status_code
        self.message = message
        self.code = code
        self.state = state
        self.retry_after = retry_after
        super().__init__(message)


class GitHubRepository(BaseModel):
    id: int
    owner: str
    name: str
    full_name: str
    default_branch: str
    html_url: str
    private: bool


class GitHubCommit(BaseModel):
    node_id: str
    sha: str
    message: str
    author_login: str | None = None
    author_name: str
    committed_at: datetime
    html_url: str
    is_merge: bool


class GitHubPullRequest(BaseModel):
    node_id: str
    number: int
    title: str
    body: str
    state: str  # open, closed, or merged
    draft: bool
    author_login: str | None = None
    created_at: datetime
    updated_at: datetime
    merged_at: datetime | None = None
    closed_at: datetime | None = None
    head_ref: str
    base_ref: str
    labels: list[str]
    requested_reviewers: list[str]
    html_url: str


_token_cache: dict[tuple[int, tuple[int, ...]], tuple[str, datetime]] = {}


def clear_token_cache() -> None:
    """Forget every cached installation token (tests, key rotation)."""
    _token_cache.clear()


def install_url(state: str) -> str:
    """Return the URL where a user installs the app and picks repositories.

    GitHub sends `state` back to the callback URL, so the frontend knows which
    project the installation belongs to.
    """
    if not settings.github_app_slug:
        raise GitHubConfigError("GITHUB_APP_SLUG is not set")
    query = urlencode({"state": state})
    return f"https://github.com/apps/{settings.github_app_slug}/installations/new?{query}"


def exchange_user_code(code: str, *, client: httpx.Client | None = None) -> str:
    """Trade the one-time `code` from the install callback for a user token.

    The token proves which GitHub user finished the installation. Callers use
    it once with `user_can_access_installation` and then discard it.
    """
    if not settings.github_app_client_id or not settings.github_app_client_secret:
        raise GitHubConfigError("GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET must be set")
    with _http(client) as http:
        try:
            response = http.post(
                GITHUB_OAUTH_TOKEN_URL,
                json={
                    "client_id": settings.github_app_client_id,
                    "client_secret": settings.github_app_client_secret,
                    "code": code,
                },
                headers={"Accept": "application/json", "User-Agent": "DevSync"},
            )
        except httpx.HTTPError as exc:
            raise _unavailable() from exc
    if not response.is_success:
        raise _error_for(response)
    body = _json(response)
    token = body.get("access_token") if isinstance(body, dict) else None
    if not isinstance(token, str) or not token:
        # GitHub answers 200 with {"error": "bad_verification_code"} for used or expired codes.
        raise GitHubError(
            400,
            "GitHub authorization code is invalid or expired",
            code="authorization_failed",
            state=IntegrationState.FAILED,
        )
    return token


def user_can_access_installation(
    user_token: str,
    installation_id: int,
    *,
    client: httpx.Client | None = None,
) -> bool:
    """Return whether the user behind `user_token` can see this installation."""
    with _http(client) as http:
        installations = _get_paginated(
            http,
            f"{settings.github_api_url}/user/installations",
            token=user_token,
            params={},
            extract=lambda body: body.get("installations") if isinstance(body, dict) else None,
        )
    return any(item.get("id") == installation_id for item in installations)


def get_installation_token(
    installation_id: int,
    *,
    repository_ids: Collection[int] | None = None,
    client: httpx.Client | None = None,
) -> str:
    """Return a token that acts as the installation, minting one if needed.

    With `repository_ids`, the token can only read those repositories and only
    with SYNC_PERMISSIONS. Without it, the token has the installation's full
    (still read-only) access, which listing repositories needs.
    """
    scope = tuple(sorted(repository_ids or ()))
    key = (installation_id, scope)
    cached = _token_cache.get(key)
    if cached is not None and cached[1] - TOKEN_REFRESH_MARGIN > datetime.now(UTC):
        return cached[0]

    body: dict[str, Any] | None = None
    if scope:
        body = {"repository_ids": list(scope), "permissions": SYNC_PERMISSIONS}
    with _http(client) as http:
        try:
            response = _request(
                http,
                "POST",
                f"{settings.github_api_url}/app/installations/{installation_id}/access_tokens",
                token=_app_jwt(),
                json=body,
            )
        except GitHubError as exc:
            if exc.status_code == 401:
                raise GitHubConfigError(
                    "GitHub rejected the app credentials; check GITHUB_APP_CLIENT_ID "
                    "and GITHUB_APP_PRIVATE_KEY"
                ) from exc
            if exc.status_code == 422 and scope:
                # The repository was removed from the installation.
                raise _revoked(422) from exc
            raise
    data = _json(response)
    token = data.get("token") if isinstance(data, dict) else None
    expires_at = _parse_time(data.get("expires_at")) if isinstance(data, dict) else None
    if not isinstance(token, str) or not token or expires_at is None:
        raise _unexpected()
    _token_cache[key] = (token, expires_at)
    return token


def list_installation_repositories(
    installation_id: int,
    *,
    client: httpx.Client | None = None,
) -> list[GitHubRepository]:
    """Return every repository the user granted this installation."""
    with _http(client) as http:
        token = get_installation_token(installation_id, client=http)
        raw = _get_paginated(
            http,
            f"{settings.github_api_url}/installation/repositories",
            token=token,
            params={},
            extract=lambda body: body.get("repositories") if isinstance(body, dict) else None,
        )
    return _normalize_all(raw, _repository)


def list_commits(
    owner: str,
    name: str,
    *,
    branch: str,
    since: datetime,
    token: str,
    client: httpx.Client | None = None,
) -> list[GitHubCommit]:
    """Return commits on `branch` dated at or after `since`, newest first.

    An empty repository has no commits; GitHub reports that as 409.
    """
    with _http(client) as http:
        raw = _get_paginated(
            http,
            f"{_repo_url(owner, name)}/commits",
            token=token,
            params={"sha": branch, "since": _iso(since)},
            accept={409},
        )
    return _normalize_all(raw, _commit)


def list_pull_requests(
    owner: str,
    name: str,
    *,
    updated_since: datetime,
    token: str,
    client: httpx.Client | None = None,
) -> list[GitHubPullRequest]:
    """Return pull requests in any state updated at or after `updated_since`.

    GitHub has no `since` filter for pulls, so this sorts by most recently
    updated and stops paging once a page reaches older pull requests.
    """

    def reached_older(page: list[dict]) -> bool:
        last = _parse_time(page[-1].get("updated_at")) if page else None
        return last is not None and last < updated_since

    with _http(client) as http:
        raw = _get_paginated(
            http,
            f"{_repo_url(owner, name)}/pulls",
            token=token,
            params={"state": "all", "sort": "updated", "direction": "desc"},
            stop=reached_older,
        )
    pulls = _normalize_all(raw, _pull_request)
    return [pull for pull in pulls if pull.updated_at >= updated_since]


def _app_jwt() -> str:
    client_id = settings.github_app_client_id
    key = settings.github_app_private_key.replace("\\n", "\n").strip()
    if not client_id or not key:
        raise GitHubConfigError("GITHUB_APP_CLIENT_ID and GITHUB_APP_PRIVATE_KEY must be set")
    now = int(time.time())
    # Backdate a minute for clock drift; GitHub rejects JWTs valid for over 10 minutes.
    payload = {"iat": now - 60, "exp": now + 540, "iss": client_id}
    try:
        return jwt.encode(payload, key, algorithm="RS256")
    except (ValueError, TypeError, jwt.PyJWTError) as exc:
        raise GitHubConfigError("GITHUB_APP_PRIVATE_KEY is not a valid RSA private key") from exc


@contextmanager
def _http(client: httpx.Client | None) -> Iterator[httpx.Client]:
    if client is not None:
        yield client
        return
    with httpx.Client(timeout=30.0) as owned:
        yield owned


def _request(
    client: httpx.Client,
    method: str,
    url: str,
    *,
    token: str,
    params: dict[str, Any] | None = None,
    json: dict[str, Any] | None = None,
    accept: Collection[int] = (),
) -> httpx.Response:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "DevSync",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
    }
    try:
        response = client.request(method, url, params=params, json=json, headers=headers)
    except httpx.HTTPError as exc:
        raise _unavailable() from exc
    if response.is_success or response.status_code in accept:
        return response
    raise _error_for(response)


def _get_paginated(
    client: httpx.Client,
    url: str,
    *,
    token: str,
    params: dict[str, Any],
    extract: Callable[[Any], Any] | None = None,
    stop: Callable[[list[dict]], bool] | None = None,
    accept: Collection[int] = (),
) -> list[dict]:
    """Follow `Link: rel="next"` headers, up to GITHUB_MAX_PAGES pages.

    The next URL already carries the query, so `params` only go on the first
    request. Links that leave the API host are refused so a token is never
    sent anywhere else.
    """
    if settings.github_max_pages < 1:
        raise GitHubConfigError("GITHUB_MAX_PAGES must be at least 1")
    items: list[dict] = []
    next_url: str | None = url
    next_params: dict[str, Any] | None = {**params, "per_page": PAGE_SIZE}
    for _ in range(settings.github_max_pages):
        response = _request(client, "GET", next_url, token=token, params=next_params, accept=accept)
        if response.status_code in accept:
            break
        body = _json(response)
        page = extract(body) if extract else body
        if not isinstance(page, list):
            raise _unexpected()
        items.extend(page)
        if stop is not None and stop(page):
            break
        next_url = response.links.get("next", {}).get("url")
        if not next_url:
            break
        if not next_url.startswith(f"{settings.github_api_url}/"):
            raise _unexpected()
        next_params = None
    return items


def _error_for(response: httpx.Response) -> GitHubError:
    status = response.status_code
    headers = response.headers
    if status in (403, 429) and (
        headers.get("x-ratelimit-remaining") == "0" or "retry-after" in headers
    ):
        return GitHubError(
            status,
            "GitHub rate limit reached",
            code="rate_limited",
            state=IntegrationState.STALE,
            retry_after=_retry_after(response),
        )
    if status in (401, 403, 404):
        return _revoked(status)
    return GitHubError(
        status,
        "GitHub is unavailable" if status >= 500 else "GitHub rejected the request",
        code="github_unavailable",
        state=IntegrationState.STALE,
    )


def _revoked(status: int) -> GitHubError:
    return GitHubError(
        status,
        "GitHub access was revoked or the repository is no longer available",
        code="github_access_revoked",
        state=IntegrationState.FAILED,
    )


def _unavailable() -> GitHubError:
    return GitHubError(
        502, "GitHub is unreachable", code="github_unavailable", state=IntegrationState.STALE
    )


def _unexpected() -> GitHubError:
    return GitHubError(
        502,
        "GitHub returned an unexpected response",
        code="github_unavailable",
        state=IntegrationState.STALE,
    )


def _retry_after(response: httpx.Response) -> int | None:
    retry = response.headers.get("retry-after", "")
    if retry.isdigit():
        return int(retry)
    reset = response.headers.get("x-ratelimit-reset", "")
    if reset.isdigit():
        return max(0, int(reset) - int(time.time()))
    return None


def _json(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError as exc:
        raise _unexpected() from exc


def _repo_url(owner: str, name: str) -> str:
    return f"{settings.github_api_url}/repos/{quote(owner, safe='')}/{quote(name, safe='')}"


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_time(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _required_time(value: object) -> datetime:
    parsed = _parse_time(value)
    if parsed is None:
        raise ValueError("missing or invalid timestamp")
    return parsed


def _normalize_all[T](raw: list[dict], normalize: Callable[[dict], T]) -> list[T]:
    try:
        return [normalize(item) for item in raw]
    except (KeyError, TypeError, ValueError, AttributeError) as exc:
        raise _unexpected() from exc


def _repository(raw: dict) -> GitHubRepository:
    owner = raw.get("owner") or {}
    return GitHubRepository(
        id=int(raw["id"]),
        owner=str(owner.get("login") or ""),
        name=str(raw["name"]),
        full_name=str(raw["full_name"]),
        default_branch=str(raw.get("default_branch") or "main"),
        html_url=str(raw.get("html_url") or ""),
        private=bool(raw.get("private")),
    )


def _commit(raw: dict) -> GitHubCommit:
    commit = raw.get("commit") or {}
    git_author = commit.get("author") or {}
    committer = commit.get("committer") or {}
    # `author` is the GitHub account; it is null when the commit email isn't linked to one.
    account = raw.get("author") or {}
    return GitHubCommit(
        node_id=str(raw["node_id"]),
        sha=str(raw["sha"]),
        message=str(commit.get("message") or ""),
        author_login=account.get("login"),
        author_name=str(git_author.get("name") or account.get("login") or "unknown"),
        committed_at=_required_time(committer.get("date") or git_author.get("date")),
        html_url=str(raw.get("html_url") or ""),
        is_merge=len(raw.get("parents") or []) > 1,
    )


def _pull_request(raw: dict) -> GitHubPullRequest:
    merged_at = _parse_time(raw.get("merged_at"))
    user = raw.get("user") or {}
    return GitHubPullRequest(
        node_id=str(raw["node_id"]),
        number=int(raw["number"]),
        title=str(raw.get("title") or ""),
        body=str(raw.get("body") or ""),
        state="merged" if merged_at else str(raw.get("state") or "open"),
        draft=bool(raw.get("draft")),
        author_login=user.get("login"),
        created_at=_required_time(raw.get("created_at")),
        updated_at=_required_time(raw.get("updated_at")),
        merged_at=merged_at,
        closed_at=_parse_time(raw.get("closed_at")),
        head_ref=str((raw.get("head") or {}).get("ref") or ""),
        base_ref=str((raw.get("base") or {}).get("ref") or ""),
        labels=[str(label["name"]) for label in raw.get("labels") or [] if label.get("name")],
        requested_reviewers=[
            str(reviewer["login"])
            for reviewer in raw.get("requested_reviewers") or []
            if reviewer.get("login")
        ],
        html_url=str(raw.get("html_url") or ""),
    )
