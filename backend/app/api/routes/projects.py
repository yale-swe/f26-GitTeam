import uuid

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.access import accessible_to, project_not_found
from app.auth import CurrentUserId
from app.db import DbSession
from app.models.deliverable import Deliverable
from app.models.enums import AnalysisStatus, IntegrationState, MilestoneStatus, ProjectRole
from app.models.milestone import Milestone
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.project_health import calculate_project_health
from app.schemas.dashboard import DashboardResponse
from app.schemas.milestone import MilestoneInput
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.project_analysis import read_latest_project_analysis

router = APIRouter(prefix="/projects", tags=["projects"])

RECENT_ACTIVITY_LIMIT = 20


def _get_project_or_404(db: DbSession, project_id: uuid.UUID, user_id: uuid.UUID) -> Project:
    stmt = (
        select(Project)
        .where(Project.id == project_id, accessible_to(user_id))
        .options(
            selectinload(Project.milestones),
            selectinload(Project.deliverables),
        )
    )
    project = db.scalars(stmt).first()
    if project is None:
        raise project_not_found()
    return project


def _get_dashboard_project_or_404(
    db: DbSession, project_id: uuid.UUID, user_id: uuid.UUID
) -> Project:
    stmt = (
        select(Project)
        .where(Project.id == project_id, accessible_to(user_id))
        .options(
            selectinload(Project.milestones),
            selectinload(Project.deliverables),
            selectinload(Project.integrations),
            selectinload(Project.activity_items),
            selectinload(Project.summaries),
        )
    )
    project = db.scalars(stmt).first()
    if project is None:
        raise project_not_found()
    return project


def _build_milestone(spec: MilestoneInput) -> Milestone:
    """Create a Milestone (plus its nested Deliverables) from an input payload.

    SQLAlchemy fills in `deliverable.milestone_id` and `deliverable.project_id`
    automatically once the milestone is attached to a project and committed.
    """
    return Milestone(
        title=spec.title,
        due_at=spec.due_at,
        status=spec.status,
        deliverables=[Deliverable(title=d.title, status=d.status) for d in spec.deliverables],
    )


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: DbSession, user_id: CurrentUserId) -> Project:
    project = Project(
        name=payload.name,
        summary=payload.summary,
        features=payload.features,
        milestones=[_build_milestone(m) for m in payload.milestones],
        # The creator owns the project; more members can be added later.
        members=[ProjectMember(user_id=user_id, role=ProjectRole.OWNER)],
    )
    # Deliverables are attached via their milestone; propagate project_id so the
    # row-level FK is populated before flush.
    for milestone in project.milestones:
        for deliverable in milestone.deliverables:
            deliverable.project = project

    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=list[ProjectRead])
def list_projects(db: DbSession, user_id: CurrentUserId) -> list[Project]:
    stmt = (
        select(Project)
        .where(accessible_to(user_id))
        .options(
            selectinload(Project.milestones),
            selectinload(Project.deliverables),
        )
        .order_by(Project.created_at.desc())
    )
    return list(db.scalars(stmt).all())


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: uuid.UUID, db: DbSession, user_id: CurrentUserId) -> Project:
    return _get_project_or_404(db, project_id, user_id)


@router.get("/{project_id}/dashboard", response_model=DashboardResponse)
def get_project_dashboard(
    project_id: uuid.UUID, db: DbSession, user_id: CurrentUserId
) -> DashboardResponse:
    """Return the stored project evidence and its calculated health in one response."""

    project = _get_dashboard_project_or_404(db, project_id, user_id)
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

    analysis = read_latest_project_analysis(project)
    blocker_evidence = analysis.output.blockers if analysis.output is not None else None
    blockers = [claim.text for claim in blocker_evidence or []]
    next_steps = (
        [claim.text for claim in analysis.output.next_steps] if analysis.output is not None else []
    )
    assessment = calculate_project_health(
        milestones=project.milestones,
        blockers=blockers if blocker_evidence is not None else None,
        activity=current_activity,
        integrations=project.integrations,
    )

    has_noncurrent_integration = any(
        integration.status != IntegrationState.HEALTHY for integration in project.integrations
    )
    latest_summary = project.summaries[0] if project.summaries else None
    if has_noncurrent_integration or analysis.status == AnalysisStatus.STALE:
        latest_summary = None
    elif (
        latest_summary is not None
        and latest_summary.structured_output is not None
        and analysis.status == AnalysisStatus.UNAVAILABLE
    ):
        latest_summary = None

    return DashboardResponse(
        project=project,
        health_score=assessment.score,
        overall_health=assessment.status,
        integrations=project.integrations,
        upcoming_deadlines=upcoming_deadlines,
        recent_activity=recent_activity,
        blockers=blockers,
        next_steps=next_steps,
        analysis_status=analysis.status,
        latest_summary=latest_summary,
    )


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: uuid.UUID, payload: ProjectUpdate, db: DbSession, user_id: CurrentUserId
) -> Project:
    project = _get_project_or_404(db, project_id, user_id)

    if payload.name is not None:
        project.name = payload.name
    if payload.summary is not None:
        project.summary = payload.summary
    if payload.features is not None:
        project.features = payload.features

    if payload.milestones is not None:
        # Replacing milestones cascades to their deliverables via the ORM's
        # `delete-orphan`. Rebuild from the input in the same shape as create.
        new_milestones = [_build_milestone(m) for m in payload.milestones]
        project.milestones = new_milestones
        for milestone in new_milestones:
            for deliverable in milestone.deliverables:
                deliverable.project = project

    db.commit()
    db.refresh(project)
    return project
