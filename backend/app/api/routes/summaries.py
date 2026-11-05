"""API route for on-demand project progress-summary generation."""

import uuid

from fastapi import APIRouter, HTTPException, status

from app.db import DbSession
from app.integrations.openrouter import OpenRouterConfigError, OpenRouterError
from app.schemas.summary import SummaryRead
from app.services.summary_context import SummaryProjectNotFound
from app.services.summary_generation import generate_and_store_summary

router = APIRouter(tags=["summaries"])


@router.post(
    "/projects/{project_id}/summaries",
    response_model=SummaryRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_summary(project_id: uuid.UUID, db: DbSession) -> SummaryRead:
    """Generate, validate, and store a new summary from current project evidence."""

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
