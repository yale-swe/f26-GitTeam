from datetime import datetime

from app.models.enums import IntegrationProvider, IntegrationState
from app.schemas.base import CamelModel


class IntegrationStatusRead(CamelModel):
    provider: IntegrationProvider
    status: IntegrationState
    last_successful_sync_at: datetime | None = None


class SyncResultRead(CamelModel):
    provider: IntegrationProvider
    status: IntegrationState
    imported_count: int
