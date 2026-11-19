from datetime import datetime

from pydantic import Field

from app.models.enums import IntegrationProvider, IntegrationState
from app.schemas.base import CamelModel


class DiscordInvite(CamelModel):
    url: str


class DiscordConnect(CamelModel):
    guild_id: str = Field(min_length=1)
    channel_id: str = Field(min_length=1)


class IntegrationStatusRead(CamelModel):
    provider: IntegrationProvider
    status: IntegrationState
    last_successful_sync_at: datetime | None = None


class SyncResultRead(CamelModel):
    provider: IntegrationProvider
    status: IntegrationState
    imported_count: int


class GitHubInstallUrl(CamelModel):
    url: str


class GitHubConnect(CamelModel):
    installation_id: int = Field(gt=0)
    authorization_code: str = Field(min_length=1)
    repository_owner: str | None = None
    repository_name: str | None = None


class GitHubRepositorySelect(CamelModel):
    repository_owner: str = Field(min_length=1)
    repository_name: str = Field(min_length=1)


class GitHubRepositoryRead(CamelModel):
    id: int
    owner: str
    name: str
    full_name: str
    default_branch: str
    html_url: str
    private: bool


class GitHubIntegrationRead(IntegrationStatusRead):
    """Status plus the selected repository; `repositories` is filled only on connect."""

    repository: GitHubRepositoryRead | None = None
    repositories: list[GitHubRepositoryRead] = []
    last_sync_error: str | None = None
