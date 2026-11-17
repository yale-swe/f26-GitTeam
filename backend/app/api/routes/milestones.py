import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.access import require_project_access
from app.auth import CurrentUserId
from app.db import DbSession
from app.milestone_progress import (
    all_deliverables_completed,
    calculate_progress,
    status_after_deliverable_change,
)
from app.models.activity import ActivityItem
from app.models.deliverable import Deliverable
from app.models.enums import IntegrationState, MilestoneStatus
from app.models.integration import Integration
from app.models.milestone import Milestone
from app.schemas.activity import ActivityItemRead
from app.schemas.deliverable import (
    DeliverableInput,
    DeliverableRead,
    DeliverableSaved,
    DeliverableUpdate,
)
from app.schemas.milestone import MilestoneDetailRead, MilestoneProgress, MilestoneUpdate

router = APIRouter(prefix="/projects/{project_id}", tags=["milestones"])

RECENT_ACTIVITY_LIMIT = 20


def _not_found(what: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "not_found", "message": f"{what} not found"},
    )


def _get_milestone(db: DbSession, project_id: uuid.UUID, milestone_id: uuid.UUID) -> Milestone:
    milestone = db.scalars(
        select(Milestone)
        .where(Milestone.id == milestone_id, Milestone.project_id == project_id)
        .options(selectinload(Milestone.deliverables))
    ).first()
    if milestone is None:
        raise _not_found("Milestone")
    return milestone


def _sync_milestone_status(db: DbSession, milestone: Milestone) -> None:
    """Let deliverable completion decide the milestone's status (see milestone_progress)."""

    db.flush()
    db.refresh(milestone, attribute_names=["deliverables"])
    milestone.status = status_after_deliverable_change(milestone.status, milestone.deliverables)


def _saved(deliverable: Deliverable, milestone: Milestone) -> DeliverableSaved:
    return DeliverableSaved(
        **DeliverableRead.model_validate(deliverable).model_dump(),
        milestone_status=milestone.status,
    )


def _recent_activity(db: DbSession, project_id: uuid.UUID) -> list[ActivityItem]:
    """Recent items from healthy integrations only, matching the dashboard."""

    healthy = select(Integration.provider).where(
        Integration.project_id == project_id, Integration.status == IntegrationState.HEALTHY
    )
    return list(
        db.scalars(
            select(ActivityItem)
            .where(ActivityItem.project_id == project_id, ActivityItem.source.in_(healthy))
            .order_by(ActivityItem.occurred_at.desc())
            .limit(RECENT_ACTIVITY_LIMIT)
        ).all()
    )


def _detail(db: DbSession, project_id: uuid.UUID, milestone: Milestone) -> MilestoneDetailRead:
    siblings = list(
        db.scalars(
            select(Milestone.id)
            .where(Milestone.project_id == project_id)
            .order_by(Milestone.due_at, Milestone.id)
        ).all()
    )
    completed, total, percent = calculate_progress(milestone.deliverables)
    return MilestoneDetailRead(
        id=milestone.id,
        project_id=project_id,
        title=milestone.title,
        due_at=milestone.due_at,
        status=milestone.status,
        position=siblings.index(milestone.id) + 1,
        total_milestones=len(siblings),
        progress=MilestoneProgress(completed=completed, total=total, percent=percent),
        deliverables=[DeliverableRead.model_validate(d) for d in milestone.deliverables],
        recent_activity=[
            ActivityItemRead.model_validate(a) for a in _recent_activity(db, project_id)
        ],
    )


@router.get("/milestones/{milestone_id}", response_model=MilestoneDetailRead)
def get_milestone(
    project_id: uuid.UUID, milestone_id: uuid.UUID, db: DbSession, user_id: CurrentUserId
) -> MilestoneDetailRead:
    require_project_access(db, project_id, user_id)
    return _detail(db, project_id, _get_milestone(db, project_id, milestone_id))


@router.patch("/milestones/{milestone_id}", response_model=MilestoneDetailRead)
def update_milestone(
    project_id: uuid.UUID,
    milestone_id: uuid.UUID,
    payload: MilestoneUpdate,
    db: DbSession,
    user_id: CurrentUserId,
) -> MilestoneDetailRead:
    require_project_access(db, project_id, user_id)
    milestone = _get_milestone(db, project_id, milestone_id)
    if payload.title is not None:
        milestone.title = payload.title
    if payload.due_at is not None:
        milestone.due_at = payload.due_at
    if (
        payload.status is not None
        and payload.status != MilestoneStatus.COMPLETED
        and all_deliverables_completed(milestone.deliverables)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "deliverables_complete",
                "message": "Every deliverable is complete. Reopen one to change the status.",
            },
        )
    if payload.status is not None:
        milestone.status = payload.status
    db.commit()
    db.refresh(milestone)
    return _detail(db, project_id, milestone)


@router.post(
    "/milestones/{milestone_id}/deliverables",
    response_model=DeliverableSaved,
    status_code=status.HTTP_201_CREATED,
)
def add_deliverable(
    project_id: uuid.UUID,
    milestone_id: uuid.UUID,
    payload: DeliverableInput,
    db: DbSession,
    user_id: CurrentUserId,
) -> DeliverableSaved:
    require_project_access(db, project_id, user_id)
    milestone = _get_milestone(db, project_id, milestone_id)
    deliverable = Deliverable(
        project_id=project_id, milestone_id=milestone.id, title=payload.title, status=payload.status
    )
    db.add(deliverable)
    _sync_milestone_status(db, milestone)
    db.commit()
    db.refresh(deliverable)
    return _saved(deliverable, milestone)


@router.patch("/deliverables/{deliverable_id}", response_model=DeliverableSaved)
def update_deliverable(
    project_id: uuid.UUID,
    deliverable_id: uuid.UUID,
    payload: DeliverableUpdate,
    db: DbSession,
    user_id: CurrentUserId,
) -> DeliverableSaved:
    require_project_access(db, project_id, user_id)
    deliverable = db.scalars(
        select(Deliverable).where(
            Deliverable.id == deliverable_id, Deliverable.project_id == project_id
        )
    ).first()
    if deliverable is None:
        raise _not_found("Deliverable")
    if payload.title is not None:
        deliverable.title = payload.title
    if payload.status is not None:
        deliverable.status = payload.status
    milestone = _get_milestone(db, project_id, deliverable.milestone_id)
    _sync_milestone_status(db, milestone)
    db.commit()
    db.refresh(deliverable)
    return _saved(deliverable, milestone)
