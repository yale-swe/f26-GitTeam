import uuid
from datetime import datetime
from typing import Annotated

from pydantic import ConfigDict, Field, StringConstraints

from app.models.enums import (
    DeliverableStatus,
    HealthStatus,
    IntegrationProvider,
    IntegrationState,
    MilestoneStatus,
)
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


class SummaryProjectEvidence(CamelModel):
    evidence_id: NonEmptyText
    name: NonEmptyText
    description: NonEmptyText
    features: list[NonEmptyText]


class SummaryDeliverableEvidence(CamelModel):
    evidence_id: NonEmptyText
    title: NonEmptyText
    status: DeliverableStatus


class SummaryMilestoneEvidence(CamelModel):
    evidence_id: NonEmptyText
    title: NonEmptyText
    due_at: datetime
    status: MilestoneStatus
    deliverables: list[SummaryDeliverableEvidence]


class SummaryActivityEvidence(CamelModel):
    evidence_id: NonEmptyText
    source: IntegrationProvider
    kind: NonEmptyText
    occurred_at: datetime
    title: NonEmptyText
    url: str | None = None


class SummaryIntegrationEvidence(CamelModel):
    evidence_id: NonEmptyText
    provider: IntegrationProvider
    status: IntegrationState
    last_successful_sync_at: datetime | None = None


class SummaryHealthEvidence(CamelModel):
    score: int | None = Field(default=None, ge=0, le=100)
    status: HealthStatus


class ProjectSummaryContext(CamelModel):
    """Minimal stored evidence that may be sent to the summary provider."""

    project: SummaryProjectEvidence
    health: SummaryHealthEvidence
    milestones: list[SummaryMilestoneEvidence]
    activity: list[SummaryActivityEvidence]
    integrations: list[SummaryIntegrationEvidence]
    limitations: list[NonEmptyText]

    @property
    def valid_evidence_ids(self) -> frozenset[str]:
        """Return every identifier the generated summary is allowed to cite."""

        evidence_ids = {self.project.evidence_id}
        evidence_ids.update(item.evidence_id for item in self.integrations)
        evidence_ids.update(item.evidence_id for item in self.activity)
        for milestone in self.milestones:
            evidence_ids.add(milestone.evidence_id)
            evidence_ids.update(item.evidence_id for item in milestone.deliverables)
        return frozenset(evidence_ids)


class SummaryRead(CamelModel):
    id: uuid.UUID
    project_id: uuid.UUID
    text: str
    generated_at: datetime
