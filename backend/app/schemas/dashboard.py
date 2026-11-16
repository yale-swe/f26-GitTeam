from datetime import datetime
from typing import Literal

from pydantic import Field

from app.models.enums import AnalysisStatus, HealthStatus, IntegrationProvider
from app.schemas.activity import ActivityItemRead
from app.schemas.base import CamelModel
from app.schemas.integration import IntegrationStatusRead
from app.schemas.milestone import MilestoneRead
from app.schemas.project import ProjectRead
from app.schemas.summary import SummaryRead


class AnalysisEvidenceRead(CamelModel):
    """Minimized stored evidence supporting one generated dashboard claim."""

    evidence_id: str
    evidence_type: Literal["project", "milestone", "deliverable", "integration", "activity"]
    title: str
    status: str | None = None
    source: IntegrationProvider | None = None
    activity_kind: str | None = None
    occurred_at: datetime | None = None
    due_at: datetime | None = None
    url: str | None = None


class AnalysisClaimRead(CamelModel):
    text: str
    evidence_ids: list[str]
    evidence: list[AnalysisEvidenceRead]


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
    blocker_details: list[AnalysisClaimRead]
    next_step_details: list[AnalysisClaimRead]
    analysis_status: AnalysisStatus
    latest_summary: SummaryRead | None = None
