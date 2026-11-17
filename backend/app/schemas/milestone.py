import uuid
from datetime import UTC, datetime, timedelta

from pydantic import Field, field_validator

from app.models.enums import MilestoneStatus
from app.schemas.activity import ActivityItemRead
from app.schemas.base import CamelModel
from app.schemas.deliverable import DeliverableInput, DeliverableRead

# Matches MAX_MILESTONE_YEARS in the frontend, plus a day so a user ahead of UTC
# can still pick the last allowed calendar day.
MAX_MILESTONE_AHEAD = timedelta(days=2 * 366 + 1)


class MilestoneInput(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    due_at: datetime
    status: MilestoneStatus = MilestoneStatus.PLANNED
    deliverables: list[DeliverableInput] = Field(default_factory=list)

    @field_validator("due_at")
    @classmethod
    def _due_at_within_limit(cls, value: datetime) -> datetime:
        due = value if value.tzinfo else value.replace(tzinfo=UTC)
        if due > datetime.now(UTC) + MAX_MILESTONE_AHEAD:
            raise ValueError("Milestone target dates must be within 2 years of today.")
        return value


class MilestoneRead(CamelModel):
    id: uuid.UUID
    title: str
    due_at: datetime
    status: MilestoneStatus


class MilestoneUpdate(CamelModel):
    """Partial update; omitted fields are left unchanged."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    due_at: datetime | None = None
    status: MilestoneStatus | None = None


class MilestoneProgress(CamelModel):
    completed: int = Field(ge=0)
    total: int = Field(ge=0)
    percent: int = Field(ge=0, le=100)


class MilestoneDetailRead(CamelModel):
    """One milestone with its deliverables, progress and recent project activity.

    Activity is not linked to individual milestones yet, so `recent_activity`
    is the project's recent activity from healthy integrations.
    """

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    due_at: datetime
    status: MilestoneStatus
    position: int = Field(ge=1)
    total_milestones: int = Field(ge=1)
    progress: MilestoneProgress
    deliverables: list[DeliverableRead]
    recent_activity: list[ActivityItemRead]
