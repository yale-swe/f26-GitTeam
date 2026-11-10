from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.auth import get_current_user
from app.db import DbSession
from app.project_health import calculate_project_health
from app.schemas.project_health import HealthScoreRequest, HealthScoreResponse

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: DbSession) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
        database = "ok"
    except SQLAlchemyError:
        database = "unavailable"
    return {"status": "ok", "database": database}


@router.post(
    "/health/score",
    response_model=HealthScoreResponse,
    dependencies=[Depends(get_current_user)],
)
def score_project_health(payload: HealthScoreRequest) -> HealthScoreResponse:
    """Calculate a project score from the evidence currently shown by the UI."""

    assessment = calculate_project_health(
        milestones=payload.milestones,
        blockers=payload.blockers,
        activity=payload.activity,
        integrations=payload.integrations,
    )
    return HealthScoreResponse(score=assessment.score, status=assessment.status)
