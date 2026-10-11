import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import DbSession
from app.models.milestone import Milestone
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def _get_project_or_404(db: DbSession, project_id: uuid.UUID) -> Project:
    stmt = select(Project).where(Project.id == project_id).options(selectinload(Project.milestones))
    project = db.scalars(stmt).first()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "Project not found"},
        )
    return project


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: DbSession) -> Project:
    project = Project(
        name=payload.name,
        summary=payload.summary,
        features=payload.features,
        deliverables=payload.deliverables,
        milestones=[
            Milestone(title=m.title, due_at=m.due_at, status=m.status) for m in payload.milestones
        ],
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=list[ProjectRead])
def list_projects(db: DbSession) -> list[Project]:
    stmt = (
        select(Project)
        .options(selectinload(Project.milestones))
        .order_by(Project.created_at.desc())
    )
    return list(db.scalars(stmt).all())


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: uuid.UUID, db: DbSession) -> Project:
    return _get_project_or_404(db, project_id)


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(project_id: uuid.UUID, payload: ProjectUpdate, db: DbSession) -> Project:
    project = _get_project_or_404(db, project_id)

    data = payload.model_dump(exclude_unset=True)
    milestones = data.pop("milestones", None)

    for field, value in data.items():
        setattr(project, field, value)

    if milestones is not None:
        project.milestones = [
            Milestone(title=m["title"], due_at=m["due_at"], status=m.get("status", "planned"))
            for m in milestones
        ]

    db.commit()
    db.refresh(project)
    return project
