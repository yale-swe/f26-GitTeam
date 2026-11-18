import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import IntegrationProvider, integration_provider_type

if TYPE_CHECKING:
    from app.models.project import Project


class ActivityItem(Base):
    """A single normalized event from an integration (commit, PR, Discord message, ...).

    `source_id` is the upstream identifier (GitHub node ID, Discord message snowflake).
    The unique index on (project_id, source, source_id) makes re-syncs idempotent.
    `details` holds source fields that do not fit the normalized columns, such as
    a Discord message's author, content, and attachments.
    """

    __tablename__ = "activity_items"
    __table_args__ = (
        UniqueConstraint("project_id", "source", "source_id", name="uq_activity_items_source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source: Mapped[IntegrationProvider] = mapped_column(integration_provider_type, nullable=False)
    source_id: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str | None] = mapped_column(String, nullable=True)
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="activity_items")
