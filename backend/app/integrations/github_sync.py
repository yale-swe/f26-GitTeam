"""Connect a project to one repository through the DevSync GitHub App.

Only the installation id and the selected repository's public identity are
stored in `integrations.config`. Tokens are minted on demand by `github.py`.
"""

import uuid

import httpx
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.integrations.github import (
    GitHubRepository,
    exchange_user_code,
    list_installation_repositories,
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


def list_repositories(
    db: Session,
    project_id: uuid.UUID,
    *,
    client: httpx.Client | None = None,
) -> list[GitHubRepository]:
    """Return the repositories the project's installation can read."""
    integration = _connected_integration(db, project_id)
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
    integration = _connected_integration(db, project_id)
    installation_id = integration.config["installation_id"]
    repositories = list_installation_repositories(installation_id, client=client)
    repository = _find_repository(repositories, owner, name)

    _set_repository(db, integration, installation_id, repository)
    db.commit()
    db.refresh(integration)
    return integration


def _github_integration(db: Session, project_id: uuid.UUID) -> Integration | None:
    return db.scalars(
        select(Integration).where(
            Integration.project_id == project_id,
            Integration.provider == IntegrationProvider.GITHUB,
        )
    ).first()


def _connected_integration(db: Session, project_id: uuid.UUID) -> Integration:
    if db.get(Project, project_id) is None:
        raise ProjectNotFound()
    integration = _github_integration(db, project_id)
    if integration is None or not integration.config.get("installation_id"):
        raise GitHubNotConnected()
    return integration


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
        db.execute(
            delete(ActivityItem).where(
                ActivityItem.project_id == integration.project_id,
                ActivityItem.source == IntegrationProvider.GITHUB,
            )
        )

    # Reassign rather than mutate: SQLAlchemy does not track in-place JSONB edits.
    integration.config = {
        "installation_id": installation_id,
        "repository": repository.model_dump() if repository else None,
    }
    integration.status = IntegrationState.CONNECTED
    integration.last_sync_error = None
