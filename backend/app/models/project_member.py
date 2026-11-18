import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.enums import ProjectRole, project_role_type

if TYPE_CHECKING:
    from app.models.project import Project


class ProjectMember(Base):
    """Grants one user access to one project.

    `user_id` is the Supabase Auth user id (the JWT `sub`). It has no foreign
    key because `auth.users` lives in Supabase and does not exist in the local
    Postgres used for development and tests.
    """

    __tablename__ = "project_members"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, index=True)
    role: Mapped[ProjectRole] = mapped_column(
        project_role_type, nullable=False, default=ProjectRole.MEMBER
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="members")
