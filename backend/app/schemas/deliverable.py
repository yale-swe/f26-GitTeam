import uuid

from pydantic import Field

from app.models.enums import DeliverableStatus
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
