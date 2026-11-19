"""Project access control: who may see and change which project."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.models.project import Project
from app.models.project_member import ProjectMember


def accessible_to(user_id: uuid.UUID) -> ColumnElement[bool]:
    """SQL condition that is true for projects `user_id` is a member of."""
    return Project.id.in_(select(ProjectMember.project_id).where(ProjectMember.user_id == user_id))


def project_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "not_found", "message": "Project not found"},
    )


def require_project_access(db: Session, project_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Raise the same 404 for a missing project and one the user cannot access.

    Using one response for both means the API never confirms that someone
    else's project exists.
    """
    allowed = db.scalar(select(Project.id).where(Project.id == project_id, accessible_to(user_id)))
    if allowed is None:
        raise project_not_found()
