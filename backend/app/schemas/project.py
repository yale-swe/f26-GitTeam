import uuid

from pydantic import Field

from app.schemas.base import CamelModel
from app.schemas.deliverable import DeliverableRead
from app.schemas.milestone import MilestoneInput, MilestoneRead


class ProjectCreate(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    summary: str = Field(min_length=1)
    features: list[str] = Field(min_length=1)
    milestones: list[MilestoneInput] = Field(min_length=1)


class ProjectUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    summary: str | None = Field(default=None, min_length=1)
    features: list[str] | None = None
    milestones: list[MilestoneInput] | None = None


class ProjectRead(CamelModel):
    id: uuid.UUID
    name: str
    summary: str
    features: list[str]
    milestones: list[MilestoneRead]
    deliverables: list[DeliverableRead]
