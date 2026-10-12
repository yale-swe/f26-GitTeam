import uuid
from datetime import datetime

from app.models.enums import IntegrationProvider
from app.schemas.base import CamelModel


class ActivityItemRead(CamelModel):
    id: uuid.UUID
    source: IntegrationProvider
    kind: str
    occurred_at: datetime
    title: str
    url: str | None = None
