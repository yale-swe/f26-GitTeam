import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.access import require_project_access
from app.auth import CurrentUserId
from app.db import DbSession
from app.integrations.github import GitHubConfigError, GitHubError, GitHubRepository, install_url
from app.integrations.github_sync import (
    GitHubInstallationForbidden,
    GitHubNotConnected,
    GitHubRepositoryNotInInstallation,
    GitHubRepositoryNotSelected,
    ProjectNotFound,
    connect_github,
    get_connected_integration,
    list_repositories,
    select_repository,
    sync_github,
)
from app.models.integration import Integration
from app.schemas.integration import (
    GitHubConnect,
    GitHubInstallUrl,
    GitHubIntegrationRead,
    GitHubRepositoryRead,
    GitHubRepositorySelect,
    SyncResultRead,
)

router = APIRouter(prefix="/github", tags=["github"])
project_router = APIRouter(prefix="/projects/{project_id}/integrations/github", tags=["github"])


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "message": message})


@contextmanager
def _github_errors() -> Iterator[None]:
    """Turn service and client exceptions into the API's `{code, message}` errors."""
    try:
        yield
    except ProjectNotFound as exc:
        raise _error(404, "not_found", "Project not found") from exc
    except GitHubNotConnected as exc:
        raise _error(409, "not_connected", "GitHub is not connected") from exc
    except GitHubRepositoryNotSelected as exc:
        raise _error(409, "repository_not_selected", "Choose a GitHub repository first") from exc
    except GitHubRepositoryNotInInstallation as exc:
        raise _error(
            400,
            "repository_not_in_installation",
            "That repository was not granted to the DevSync GitHub App",
        ) from exc
    except GitHubInstallationForbidden as exc:
        raise _error(
            403, "installation_forbidden", "You cannot access that GitHub installation"
        ) from exc
    except GitHubConfigError as exc:
        raise _error(500, "config_error", str(exc)) from exc
    except GitHubError as exc:
        # An expired install code is the caller's problem; anything else is GitHub's.
        status_code = 400 if exc.code == "authorization_failed" else 502
        detail: dict = {"code": exc.code, "message": exc.message}
        if exc.retry_after is not None:
            detail["retryAfter"] = exc.retry_after
        raise HTTPException(status_code=status_code, detail=detail) from exc


def _integration_read(
    integration: Integration, repositories: list[GitHubRepository] | None = None
) -> GitHubIntegrationRead:
    return GitHubIntegrationRead(
        provider=integration.provider,
        status=integration.status,
        last_successful_sync_at=integration.last_successful_sync_at,
        last_sync_error=integration.last_sync_error,
        repository=integration.config.get("repository"),
        repositories=[repo.model_dump() for repo in repositories or []],
    )


@router.get("/install-url", response_model=GitHubInstallUrl)
def get_install_url(
    db: DbSession,
    user_id: CurrentUserId,
    project_id: Annotated[uuid.UUID, Query(alias="projectId")],
) -> GitHubInstallUrl:
    """Return the GitHub page that installs the app; `state` carries the project id."""
    require_project_access(db, project_id, user_id)
    with _github_errors():
        return GitHubInstallUrl(url=install_url(str(project_id)))


@project_router.post("", response_model=GitHubIntegrationRead)
def connect(
    project_id: uuid.UUID, payload: GitHubConnect, db: DbSession, user_id: CurrentUserId
) -> GitHubIntegrationRead:
    """Finish the install callback: attach the installation and maybe a repository."""
    require_project_access(db, project_id, user_id)
    with _github_errors():
        integration, repositories = connect_github(
            db,
            project_id,
            installation_id=payload.installation_id,
            authorization_code=payload.authorization_code,
            repository_owner=payload.repository_owner,
            repository_name=payload.repository_name,
        )
    return _integration_read(integration, repositories)


@project_router.get("", response_model=GitHubIntegrationRead)
def get_status(
    project_id: uuid.UUID, db: DbSession, user_id: CurrentUserId
) -> GitHubIntegrationRead:
    require_project_access(db, project_id, user_id)
    with _github_errors():
        return _integration_read(get_connected_integration(db, project_id))


@project_router.get("/repositories", response_model=list[GitHubRepositoryRead])
def get_repositories(
    project_id: uuid.UUID, db: DbSession, user_id: CurrentUserId
) -> list[GitHubRepositoryRead]:
    require_project_access(db, project_id, user_id)
    with _github_errors():
        repositories = list_repositories(db, project_id)
    return [GitHubRepositoryRead.model_validate(repo.model_dump()) for repo in repositories]


@project_router.put("/repository", response_model=GitHubIntegrationRead)
def choose_repository(
    project_id: uuid.UUID,
    payload: GitHubRepositorySelect,
    db: DbSession,
    user_id: CurrentUserId,
) -> GitHubIntegrationRead:
    require_project_access(db, project_id, user_id)
    with _github_errors():
        integration = select_repository(
            db, project_id, owner=payload.repository_owner, name=payload.repository_name
        )
    return _integration_read(integration)


@project_router.post("/sync", response_model=SyncResultRead)
def sync(project_id: uuid.UUID, db: DbSession, user_id: CurrentUserId) -> SyncResultRead:
    """Import new commits and pull requests from the selected repository."""
    require_project_access(db, project_id, user_id)
    with _github_errors():
        integration, imported_count = sync_github(db, project_id)
    return SyncResultRead(
        provider=integration.provider,
        status=integration.status,
        imported_count=imported_count,
    )
