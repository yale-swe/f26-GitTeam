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
