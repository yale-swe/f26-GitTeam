from pydantic import Field

from app.models.enums import AnalysisStatus, HealthStatus
from app.schemas.activity import ActivityItemRead
from app.schemas.base import CamelModel
from app.schemas.integration import IntegrationStatusRead
from app.schemas.milestone import MilestoneRead
from app.schemas.project import ProjectRead
from app.schemas.summary import SummaryRead


class DashboardResponse(CamelModel):
    """Combined project-health data returned to the dashboard frontend."""

    project: ProjectRead
    health_score: int | None = Field(default=None, ge=0, le=100)
    overall_health: HealthStatus
    integrations: list[IntegrationStatusRead]
    upcoming_deadlines: list[MilestoneRead]
    recent_activity: list[ActivityItemRead]
    blockers: list[str]
    next_steps: list[str]
    analysis_status: AnalysisStatus
    latest_summary: SummaryRead | None = None
