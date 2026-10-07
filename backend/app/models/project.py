import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.activity import ActivityItem
    from app.models.integration import Integration
    from app.models.milestone import Milestone
    from app.models.summary import Summary


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(String, nullable=False)
    features: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, server_default="{}")
    deliverables: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    milestones: Mapped[list["Milestone"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Milestone.due_at",
    )
    integrations: Mapped[list["Integration"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    activity_items: Mapped[list["ActivityItem"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    summaries: Mapped[list["Summary"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Summary.generated_at.desc()",
    )
