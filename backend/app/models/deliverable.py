import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import DeliverableStatus, deliverable_status_type

if TYPE_CHECKING:
    from app.models.milestone import Milestone
    from app.models.project import Project


class Deliverable(Base):
    """A concrete piece of work owned by exactly one milestone.

    Deliverables are the unit the health score and the frontend progress bar
    count against (`completed / total`). They used to live on `projects` as a
    bare `TEXT[]` which couldn't carry status or an ownership link to a
    milestone; this model replaces that.
    """

    __tablename__ = "deliverables"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    milestone_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("milestones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[DeliverableStatus] = mapped_column(
        deliverable_status_type, nullable=False, default=DeliverableStatus.PLANNED
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

    project: Mapped["Project"] = relationship(back_populates="deliverables")
    milestone: Mapped["Milestone"] = relationship(back_populates="deliverables")
