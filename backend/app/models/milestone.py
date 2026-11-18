import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import MilestoneStatus, milestone_status_type

if TYPE_CHECKING:
    from app.models.deliverable import Deliverable
    from app.models.project import Project


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[MilestoneStatus] = mapped_column(
        milestone_status_type, nullable=False, default=MilestoneStatus.PLANNED
    )

    project: Mapped["Project"] = relationship(back_populates="milestones")
    deliverables: Mapped[list["Deliverable"]] = relationship(
        back_populates="milestone",
        cascade="all, delete-orphan",
        order_by="Deliverable.created_at",
    )
