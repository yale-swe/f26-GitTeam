"""Build minimized, grounded project evidence for progress-summary generation."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.activity import ActivityItem
from app.models.enums import IntegrationProvider, IntegrationState
from app.models.milestone import Milestone
from app.models.project import Project
from app.project_health import calculate_project_health
from app.schemas.summary import (
    ProjectSummaryContext,
    SummaryActivityEvidence,
    SummaryDeliverableEvidence,
    SummaryHealthEvidence,
    SummaryIntegrationEvidence,
    SummaryMilestoneEvidence,
    SummaryProjectEvidence,
)

SUMMARY_ACTIVITY_LIMIT = 50
_PROVIDER_LABELS = {
    IntegrationProvider.GITHUB: "GitHub",
    IntegrationProvider.DISCORD: "Discord",
}


class SummaryProjectNotFound(Exception):
    """Raised when summary context is requested for an unknown project."""


def build_summary_context(
    db: Session,
    project_id: uuid.UUID,
    *,
    activity_limit: int = SUMMARY_ACTIVITY_LIMIT,
) -> ProjectSummaryContext:
    """Return current project evidence without credentials or provider-specific details."""

    if activity_limit < 1:
        raise ValueError("activity_limit must be at least 1")

    stmt = (
        select(Project)
        .where(Project.id == project_id)
        .options(
            selectinload(Project.milestones).selectinload(Milestone.deliverables),
            selectinload(Project.integrations),
            selectinload(Project.activity_items),
        )
    )
    project = db.scalars(stmt).first()
    if project is None:
        raise SummaryProjectNotFound()

    current_sources = {
        integration.provider
        for integration in project.integrations
        if integration.status == IntegrationState.HEALTHY
    }
    current_activity = sorted(
        (item for item in project.activity_items if item.source in current_sources),
        key=lambda item: (item.occurred_at, str(item.id)),
        reverse=True,
    )
    assessment = calculate_project_health(
        milestones=project.milestones,
        blockers=[],
        activity=current_activity,
        integrations=project.integrations,
    )

    integration_evidence = sorted(
        (
            SummaryIntegrationEvidence(
                evidence_id=_evidence_id("integration", item.id),
                provider=item.provider,
                status=item.status,
                last_successful_sync_at=item.last_successful_sync_at,
            )
            for item in project.integrations
        ),
        key=lambda item: item.provider.value,
    )

    return ProjectSummaryContext(
        project=SummaryProjectEvidence(
            evidence_id=_evidence_id("project", project.id),
            name=project.name,
            description=project.summary,
            features=project.features,
        ),
        health=SummaryHealthEvidence(score=assessment.score, status=assessment.status),
        milestones=[
            SummaryMilestoneEvidence(
                evidence_id=_evidence_id("milestone", milestone.id),
                title=milestone.title,
                due_at=milestone.due_at,
                status=milestone.status,
                deliverables=[
                    SummaryDeliverableEvidence(
                        evidence_id=_evidence_id("deliverable", deliverable.id),
                        title=deliverable.title,
                        status=deliverable.status,
                    )
                    for deliverable in milestone.deliverables
                ],
            )
            for milestone in project.milestones
        ],
        activity=[
            SummaryActivityEvidence(
                evidence_id=_evidence_id("activity", item.id),
                source=item.source,
                kind=item.kind,
                occurred_at=item.occurred_at,
                title=item.title,
                url=item.url,
            )
            for item in current_activity[:activity_limit]
        ],
        integrations=integration_evidence,
        limitations=_limitations(project, current_sources, current_activity),
    )


def _limitations(
    project: Project,
    current_sources: set[IntegrationProvider],
    current_activity: list[ActivityItem],
) -> list[str]:
    limitations: list[str] = []
    connected_sources = {item.provider for item in project.integrations}

    for provider in IntegrationProvider:
        label = _PROVIDER_LABELS[provider]
        if provider not in connected_sources:
            limitations.append(f"{label} integration is not connected.")

    for integration in sorted(project.integrations, key=lambda item: item.provider.value):
        if integration.status != IntegrationState.HEALTHY:
            limitations.append(
                f"{_PROVIDER_LABELS[integration.provider]} integration is "
                f"{integration.status.value}; its activity is not treated as current."
            )

    activity_sources = {item.source for item in current_activity}
    for provider in sorted(current_sources, key=lambda item: item.value):
        if provider not in activity_sources:
            limitations.append(
                f"{_PROVIDER_LABELS[provider]} integration is healthy, but no synchronized "
                "activity is available."
            )

    return limitations


def _evidence_id(kind: str, value: uuid.UUID) -> str:
    return f"{kind}:{value}"
