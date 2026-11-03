import uuid
from datetime import datetime

from pydantic import Field

from app.models.enums import MilestoneStatus
from app.schemas.base import CamelModel
from app.schemas.deliverable import DeliverableInput


class MilestoneInput(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    due_at: datetime
    status: MilestoneStatus = MilestoneStatus.PLANNED
    deliverables: list[DeliverableInput] = Field(default_factory=list)


class MilestoneRead(CamelModel):
    id: uuid.UUID
    title: str
    due_at: datetime
    status: MilestoneStatus
