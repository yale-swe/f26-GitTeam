"""API route for on-demand project progress-summary generation."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.access import require_project_access
from app.auth import CurrentUserId
from app.config import settings
from app.db import DbSession
from app.integrations.openrouter import OpenRouterConfigError, OpenRouterError
from app.models.summary import Summary
from app.schemas.summary import SummaryRead
from app.services.summary_context import SummaryProjectNotFound
from app.services.summary_generation import generate_and_store_summary

router = APIRouter(tags=["summaries"])


def _enforce_cooldown(db: DbSession, project_id: uuid.UUID) -> None:
    """Reject a new generation soon after the last one for this project.

    Stored in the database (the newest summary's timestamp) so it holds across
    server restarts and multiple instances. Failed generations store nothing,
    so they are not rate limited by this check.
    """
    interval = settings.summary_min_interval_seconds
    if interval <= 0:
        return
    latest = db.scalar(
        select(func.max(Summary.generated_at)).where(Summary.project_id == project_id)
    )
    if latest is None:
        return
    wait = interval - (datetime.now(UTC) - latest).total_seconds()
    if wait > 0:
        retry_after = int(wait) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "summary_rate_limited",
                "message": f"A summary was just generated. Try again in {retry_after} seconds.",
            },
            headers={"Retry-After": str(retry_after)},
        )


@router.post(
    "/projects/{project_id}/summaries",
    response_model=SummaryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_summary(
    project_id: uuid.UUID, db: DbSession, user_id: CurrentUserId
) -> SummaryRead:
    """Generate, validate, and store a new summary from current project evidence."""

    # Check access before any LLM call so other users' projects cost nothing.
    require_project_access(db, project_id, user_id)
    _enforce_cooldown(db, project_id)
    try:
        summary = generate_and_store_summary(db, project_id)
    except SummaryProjectNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "not_found", "message": "Project not found"},
        ) from exc
    except OpenRouterConfigError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "summary_provider_not_configured",
                "message": "Project summary generation is not configured",
            },
        ) from exc
    except OpenRouterError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    return SummaryRead.model_validate(summary)
