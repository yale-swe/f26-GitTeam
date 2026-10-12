import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import (
    IntegrationProvider,
    IntegrationState,
    integration_provider_type,
    integration_state_type,
)

if TYPE_CHECKING:
    from app.models.project import Project


class Integration(Base):
    """A per-project connection to an external service (GitHub repo, Discord channel).

    Only non-secret config lives here (repo owner/name, channel/guild IDs). Credential
    storage is intentionally deferred to the auth owner so the encryption design can
    be chosen before columns are frozen.
    """

    __tablename__ = "integrations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[IntegrationProvider] = mapped_column(integration_provider_type, nullable=False)
    status: Mapped[IntegrationState] = mapped_column(
        integration_state_type, nullable=False, default=IntegrationState.CONNECTED
    )
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    last_successful_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_sync_error: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    project: Mapped["Project"] = relationship(back_populates="integrations")
