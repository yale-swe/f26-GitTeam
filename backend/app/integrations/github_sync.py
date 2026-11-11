"""Connect a project to one repository through the DevSync GitHub App, then sync it.

Only the installation id and the selected repository's public identity are
stored in `integrations.config`. Tokens are minted on demand by `github.py`.
"""

import uuid
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import settings
from app.integrations.github import (
    GitHubCommit,
    GitHubError,
    GitHubPullRequest,
    GitHubRepository,
    exchange_user_code,
    get_installation_token,
    list_commits,
    list_installation_repositories,
    list_pull_requests,
    user_can_access_installation,
)
from app.models.activity import ActivityItem
from app.models.enums import IntegrationProvider, IntegrationState
from app.models.integration import Integration
from app.models.project import Project


class ProjectNotFound(Exception):
    """Raised when the project id does not exist."""


class GitHubNotConnected(Exception):
    """Raised when a project has no GitHub installation yet."""


class GitHubRepositoryNotSelected(Exception):
    """Raised when the installation has several repositories and none was chosen."""


class GitHubInstallationForbidden(Exception):
    """Raised when the signed-in GitHub user cannot see the installation."""


class GitHubRepositoryNotInInstallation(Exception):
    """Raised when the chosen repository was not granted to the installation."""


def connect_github(
    db: Session,
    project_id: uuid.UUID,
    *,
    installation_id: int,
    authorization_code: str,
    repository_owner: str | None = None,
    repository_name: str | None = None,
    client: httpx.Client | None = None,
) -> tuple[Integration, list[GitHubRepository]]:
    """Attach a GitHub App installation to a project.

    The one-time code proves the user finished the installation, so nobody can
    attach an installation id they guessed. The repository is the one given,
    else the one already selected, else the only one the installation has.
    """
    project = db.get(Project, project_id)
    if project is None:
        raise ProjectNotFound()

    user_token = exchange_user_code(authorization_code, client=client)
    if not user_can_access_installation(user_token, installation_id, client=client):
        raise GitHubInstallationForbidden()
    repositories = list_installation_repositories(installation_id, client=client)

    integration = _github_integration(db, project.id)
    if integration is None:
        integration = Integration(
            project_id=project.id,
            provider=IntegrationProvider.GITHUB,
            status=IntegrationState.CONNECTED,
            config={},
        )
        db.add(integration)

    if repository_owner and repository_name:
        repository = _find_repository(repositories, repository_owner, repository_name)
    else:
        repository = _current_repository(integration, repositories)
        if repository is None and len(repositories) == 1:
            repository = repositories[0]

    _set_repository(db, integration, installation_id, repository)
    db.commit()
    db.refresh(integration)
    return integration, repositories


def get_connected_integration(db: Session, project_id: uuid.UUID) -> Integration:
    """Return the project's GitHub integration, or raise if it has none."""
    if db.get(Project, project_id) is None:
        raise ProjectNotFound()
    integration = _github_integration(db, project_id)
    if integration is None or not integration.config.get("installation_id"):
        raise GitHubNotConnected()
    return integration


def list_repositories(
    db: Session,
    project_id: uuid.UUID,
    *,
    client: httpx.Client | None = None,
) -> list[GitHubRepository]:
    """Return the repositories the project's installation can read."""
    integration = get_connected_integration(db, project_id)
    return list_installation_repositories(integration.config["installation_id"], client=client)


def select_repository(
    db: Session,
    project_id: uuid.UUID,
    *,
    owner: str,
    name: str,
    client: httpx.Client | None = None,
) -> Integration:
    """Choose which of the installation's repositories this project syncs."""
    integration = get_connected_integration(db, project_id)
    installation_id = integration.config["installation_id"]
    repositories = list_installation_repositories(installation_id, client=client)
    repository = _find_repository(repositories, owner, name)

    _set_repository(db, integration, installation_id, repository)
    db.commit()
    db.refresh(integration)
    return integration


def sync_github(
    db: Session,
    project_id: uuid.UUID,
    *,
    client: httpx.Client | None = None,
    now: datetime | None = None,
) -> tuple[Integration, int]:
    """Import default-branch commits and pull requests into activity items.

    Everything is fetched before anything is written, so a failed sync keeps
    the previous activity and `last_successful_sync_at` as they were and only
    marks the integration stale or failed. Rows are keyed by GitHub node id,
    so re-importing updates them instead of adding duplicates.
    """
    integration = get_connected_integration(db, project_id)
    if not integration.config.get("repository"):
        raise GitHubRepositoryNotSelected()
    repository = GitHubRepository.model_validate(integration.config["repository"])

    now = now or datetime.now(UTC)
    if integration.last_successful_sync_at is None:
        since = now - timedelta(days=settings.github_backfill_days)
    else:
        # Overlap catches commits pushed late or rebased onto older dates.
        since = integration.last_successful_sync_at - timedelta(
            hours=settings.github_sync_overlap_hours
        )

    try:
        token = get_installation_token(
            integration.config["installation_id"],
            repository_ids=[repository.id],
            client=client,
        )
        commits = list_commits(
            repository.owner,
            repository.name,
            branch=repository.default_branch,
            since=since,
            token=token,
            client=client,
        )
        pulls = list_pull_requests(
            repository.owner,
            repository.name,
            updated_since=since,
            token=token,
            client=client,
        )
    except GitHubError as exc:
        integration.status = exc.state
        integration.last_sync_error = exc.message
        db.commit()
        raise

    # Keyed by source id: one INSERT ... ON CONFLICT cannot touch the same row
    # twice, and an item can show up on two pages if data shifts mid-sync.
    rows: dict[str, dict] = {}
    for commit in commits:
        rows[commit.node_id] = _commit_row(project_id, repository, commit)
    for pull in pulls:
        rows[pull.node_id] = _pull_request_row(project_id, repository, pull)
    if rows:
        stmt = insert(ActivityItem).values(list(rows.values()))
        stmt = stmt.on_conflict_do_update(
            constraint="uq_activity_items_source",
            set_={
                "kind": stmt.excluded.kind,
                "occurred_at": stmt.excluded.occurred_at,
                "title": stmt.excluded.title,
                "url": stmt.excluded.url,
                "details": stmt.excluded.details,
            },
        )
        db.execute(stmt)

    integration.status = IntegrationState.HEALTHY
    integration.last_sync_error = None
    integration.last_successful_sync_at = now
    db.commit()
    db.refresh(integration)
    return integration, len(rows)


def disconnect_github(db: Session, project_id: uuid.UUID) -> None:
    """Forget the project's GitHub connection and all activity it imported.

    This does not uninstall the app on github.com; users do that themselves.
    Calling it when GitHub is not connected does nothing.
    """
    if db.get(Project, project_id) is None:
        raise ProjectNotFound()
    _delete_github_activity(db, project_id)
    db.execute(
        delete(Integration).where(
            Integration.project_id == project_id,
            Integration.provider == IntegrationProvider.GITHUB,
        )
    )
    db.commit()


def _github_integration(db: Session, project_id: uuid.UUID) -> Integration | None:
    return db.scalars(
        select(Integration).where(
            Integration.project_id == project_id,
            Integration.provider == IntegrationProvider.GITHUB,
        )
    ).first()


def _find_repository(
    repositories: list[GitHubRepository], owner: str, name: str
) -> GitHubRepository:
    full_name = f"{owner}/{name}".lower()
    for repository in repositories:
        if repository.full_name.lower() == full_name:
            return repository
    raise GitHubRepositoryNotInInstallation()


def _current_repository(
    integration: Integration, repositories: list[GitHubRepository]
) -> GitHubRepository | None:
    current_id = (integration.config.get("repository") or {}).get("id")
    return next((repo for repo in repositories if repo.id == current_id), None)


def _set_repository(
    db: Session,
    integration: Integration,
    installation_id: int,
    repository: GitHubRepository | None,
) -> None:
    """Store the selection; switching repositories drops the old repo's activity."""
    previous_id = (integration.config.get("repository") or {}).get("id")
    if previous_id != (repository.id if repository else None):
        integration.last_successful_sync_at = None
        _delete_github_activity(db, integration.project_id)

    # Reassign rather than mutate: SQLAlchemy does not track in-place JSONB edits.
    integration.config = {
        "installation_id": installation_id,
        "repository": repository.model_dump() if repository else None,
    }
    integration.status = IntegrationState.CONNECTED
    integration.last_sync_error = None


def _delete_github_activity(db: Session, project_id: uuid.UUID) -> None:
    db.execute(
        delete(ActivityItem).where(
            ActivityItem.project_id == project_id,
            ActivityItem.source == IntegrationProvider.GITHUB,
        )
    )


def _commit_row(project_id: uuid.UUID, repository: GitHubRepository, commit: GitHubCommit) -> dict:
    first_line = commit.message.strip().split("\n", 1)[0]
    return {
        "id": uuid.uuid4(),
        "project_id": project_id,
        "source": IntegrationProvider.GITHUB.value,
        "source_id": commit.node_id,
        "kind": "commit",
        "occurred_at": commit.committed_at,
        "title": _truncate(first_line or f"Commit {commit.sha[:7]}", 240),
        "url": commit.html_url,
        "details": {
            "repository": repository.full_name,
            "sha": commit.sha,
            "branch": repository.default_branch,
            "author_login": commit.author_login,
            "author_name": commit.author_name,
            "message": _truncate(commit.message, 2000),
            "is_merge": commit.is_merge,
        },
    }


def _pull_request_row(
    project_id: uuid.UUID, repository: GitHubRepository, pull: GitHubPullRequest
) -> dict:
    return {
        "id": uuid.uuid4(),
        "project_id": project_id,
        "source": IntegrationProvider.GITHUB.value,
        "source_id": pull.node_id,
        "kind": "pull_request",
        # updated_at, so a PR that was just merged or reviewed counts as recent (OPEN-5).
        "occurred_at": pull.updated_at,
        "title": _truncate(pull.title or f"Pull request #{pull.number}", 240),
        "url": pull.html_url,
        "details": {
            "repository": repository.full_name,
            "number": pull.number,
            "state": pull.state,
            "draft": pull.draft,
            "author_login": pull.author_login,
            "created_at": _isoformat(pull.created_at),
            "updated_at": _isoformat(pull.updated_at),
            "merged_at": _isoformat(pull.merged_at),
            "closed_at": _isoformat(pull.closed_at),
            "head_ref": pull.head_ref,
            "base_ref": pull.base_ref,
            "labels": pull.labels,
            "requested_reviewers": pull.requested_reviewers,
            "body": _truncate(pull.body, 2000),
        },
    }


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _isoformat(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
