import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import DbSession
from app.models.enums import IntegrationState, MilestoneStatus
from app.models.milestone import Milestone
from app.models.project import Project
from app.project_health import calculate_project_health
from app.schemas.dashboard import DashboardResponse
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])

RECENT_ACTIVITY_LIMIT = 20


def _get_project_or_404(db: DbSession, project_id: uuid.UUID) -> Project:
    stmt = select(Project).where(Project.id == project_id).options(selectinload(Project.milestones))
    project = db.scalars(stmt).first()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "Project not found"},
        )
    return project


def _get_dashboard_project_or_404(db: DbSession, project_id: uuid.UUID) -> Project:
    stmt = (
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.milestones),
            selectinload(Project.integrations),
            selectinload(Project.activity_items),
            selectinload(Project.summaries),
        )
    )
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


@router.get("/{project_id}/dashboard", response_model=DashboardResponse)
def get_project_dashboard(project_id: uuid.UUID, db: DbSession) -> DashboardResponse:
    """Return the stored project evidence and its calculated health in one response."""

    project = _get_dashboard_project_or_404(db, project_id)
    current_sources = {
        integration.provider
        for integration in project.integrations
        if integration.status == IntegrationState.HEALTHY
    }
    current_activity = sorted(
        (item for item in project.activity_items if item.source in current_sources),
        key=lambda item: item.occurred_at,
        reverse=True,
    )
    recent_activity = current_activity[:RECENT_ACTIVITY_LIMIT]
    upcoming_deadlines = sorted(
        (
            milestone
            for milestone in project.milestones
            if milestone.status != MilestoneStatus.COMPLETED
        ),
        key=lambda milestone: milestone.due_at,
    )

    # Blocker and next-step extraction is not stored yet. Empty lists avoid
    # presenting placeholder content as real project evidence (UC4-AC6).
    blockers: list[str] = []
    next_steps: list[str] = []
    assessment = calculate_project_health(
        milestones=project.milestones,
        blockers=blockers,
        activity=current_activity,
        integrations=project.integrations,
    )

    has_noncurrent_integration = any(
        integration.status != IntegrationState.HEALTHY for integration in project.integrations
    )
    latest_summary = (
        project.summaries[0] if project.summaries and not has_noncurrent_integration else None
    )

    return DashboardResponse(
        project=project,
        health_score=assessment.score,
        overall_health=assessment.status,
        integrations=project.integrations,
        upcoming_deadlines=upcoming_deadlines,
        recent_activity=recent_activity,
        blockers=blockers,
        next_steps=next_steps,
        latest_summary=latest_summary,
    )


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
