import uuid

from pydantic import Field

from app.models.enums import DeliverableStatus, MilestoneStatus
from app.schemas.base import CamelModel


class DeliverableInput(CamelModel):
    """A deliverable nested inside a milestone in a create/update request."""

    title: str = Field(min_length=1, max_length=255)
    status: DeliverableStatus = DeliverableStatus.PLANNED


class DeliverableRead(CamelModel):
    id: uuid.UUID
    milestone_id: uuid.UUID
    title: str
    status: DeliverableStatus


class DeliverableSaved(DeliverableRead):
    """A deliverable after it was created or changed, plus its milestone's new status."""

    milestone_status: MilestoneStatus


class DeliverableUpdate(CamelModel):
    """Partial update; omitted fields are left unchanged."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: DeliverableStatus | None = None
