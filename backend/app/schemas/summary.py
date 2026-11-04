import uuid
from datetime import datetime
from typing import Annotated

from pydantic import ConfigDict, Field, StringConstraints

from app.schemas.base import CamelModel

NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class SummaryClaim(CamelModel):
    """One generated statement grounded in stored project or activity evidence."""

    model_config = ConfigDict(extra="forbid")

    text: NonEmptyText
    evidence_ids: list[NonEmptyText] = Field(min_length=1)


class GeneratedProjectSummary(CamelModel):
    """Validated, provider-independent structure expected from the LLM."""

    model_config = ConfigDict(extra="forbid")

    recent_progress: list[SummaryClaim]
    upcoming_milestones: list[SummaryClaim]
    notable_activity: list[SummaryClaim]
    blockers: list[SummaryClaim]
    next_steps: list[SummaryClaim]
    limitations: list[NonEmptyText]


class SummaryRead(CamelModel):
    id: uuid.UUID
    project_id: uuid.UUID
    text: str
    generated_at: datetime
