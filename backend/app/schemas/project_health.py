from datetime import datetime

from pydantic import Field

from app.models.enums import (
    HealthStatus,
    IntegrationProvider,
    IntegrationState,
    MilestoneStatus,
)
from app.schemas.base import CamelModel


class HealthMilestoneInput(CamelModel):
    title: str
    due_at: datetime
    status: MilestoneStatus


class HealthActivityInput(CamelModel):
    source: IntegrationProvider
    occurred_at: datetime


class HealthIntegrationInput(CamelModel):
    provider: IntegrationProvider
    status: IntegrationState


class HealthScoreRequest(CamelModel):
    milestones: list[HealthMilestoneInput]
    blockers: list[str]
    activity: list[HealthActivityInput]
    integrations: list[HealthIntegrationInput]


class HealthScoreResponse(CamelModel):
    score: int | None = Field(default=None, ge=0, le=100)
    status: HealthStatus
