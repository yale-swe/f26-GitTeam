"""Read the latest evidence-backed project analysis without calling the LLM."""

from dataclasses import dataclass
from datetime import UTC, datetime

from pydantic import ValidationError

from app.models.enums import AnalysisStatus, IntegrationState
from app.models.project import Project
from app.schemas.dashboard import AnalysisClaimRead, AnalysisEvidenceRead
from app.schemas.summary import GeneratedProjectSummary, SummaryClaim


@dataclass(frozen=True)
class ProjectAnalysisResult:
    status: AnalysisStatus
    output: GeneratedProjectSummary | None = None


def read_latest_project_analysis(project: Project) -> ProjectAnalysisResult:
    """Return a validated analysis only while its source snapshot is current."""

    if not project.summaries:
        return ProjectAnalysisResult(status=AnalysisStatus.UNAVAILABLE)

    summary = project.summaries[0]
    if summary.structured_output is None:
        return ProjectAnalysisResult(status=AnalysisStatus.UNAVAILABLE)

    try:
        output = GeneratedProjectSummary.model_validate(summary.structured_output)
    except (TypeError, ValidationError):
        return ProjectAnalysisResult(status=AnalysisStatus.UNAVAILABLE)

    if not _claims_are_grounded(output, project):
        return ProjectAnalysisResult(status=AnalysisStatus.UNAVAILABLE)

    generated_at = _as_utc(summary.generated_at)
    if _as_utc(project.updated_at) > generated_at:
        return ProjectAnalysisResult(status=AnalysisStatus.STALE)

    if any(item.status != IntegrationState.HEALTHY for item in project.integrations):
        return ProjectAnalysisResult(status=AnalysisStatus.STALE)

    if any(
        item.last_successful_sync_at is not None
        and _as_utc(item.last_successful_sync_at) > generated_at
        for item in project.integrations
    ):
        return ProjectAnalysisResult(status=AnalysisStatus.STALE)

    return ProjectAnalysisResult(status=AnalysisStatus.CURRENT, output=output)


def resolve_analysis_claims(
    project: Project, claims: list[SummaryClaim]
) -> list[AnalysisClaimRead]:
    """Attach minimized project-owned evidence to already validated claims."""

    evidence = _evidence_index(project)
    return [
        AnalysisClaimRead(
            text=claim.text,
            evidence_ids=claim.evidence_ids,
            evidence=[evidence[evidence_id] for evidence_id in claim.evidence_ids],
        )
        for claim in claims
    ]


def _claims_are_grounded(output: GeneratedProjectSummary, project: Project) -> bool:
    allowed = set(_evidence_index(project))
    cited = {evidence_id for claim in _claims(output) for evidence_id in claim.evidence_ids}
    return cited <= allowed


def _evidence_index(project: Project) -> dict[str, AnalysisEvidenceRead]:
    evidence = {
        f"project:{project.id}": AnalysisEvidenceRead(
            evidence_id=f"project:{project.id}",
            evidence_type="project",
            title=project.name,
        )
    }
    evidence.update(
        {
            f"milestone:{item.id}": AnalysisEvidenceRead(
                evidence_id=f"milestone:{item.id}",
                evidence_type="milestone",
                title=item.title,
                status=item.status.value,
                due_at=item.due_at,
            )
            for item in project.milestones
        }
    )
    evidence.update(
        {
            f"deliverable:{item.id}": AnalysisEvidenceRead(
                evidence_id=f"deliverable:{item.id}",
                evidence_type="deliverable",
                title=item.title,
                status=item.status.value,
            )
            for item in project.deliverables
        }
    )
    evidence.update(
        {
            f"integration:{item.id}": AnalysisEvidenceRead(
                evidence_id=f"integration:{item.id}",
                evidence_type="integration",
                title=f"{item.provider.value.title()} integration",
                status=item.status.value,
                source=item.provider,
            )
            for item in project.integrations
        }
    )
    evidence.update(
        {
            f"activity:{item.id}": AnalysisEvidenceRead(
                evidence_id=f"activity:{item.id}",
                evidence_type="activity",
                title=item.title,
                source=item.source,
                activity_kind=item.kind,
                occurred_at=item.occurred_at,
                url=item.url,
            )
            for item in project.activity_items
        }
    )
    return evidence


def _claims(output: GeneratedProjectSummary) -> list[SummaryClaim]:
    return [
        *output.recent_progress,
        *output.upcoming_milestones,
        *output.notable_activity,
        *output.blockers,
        *output.next_steps,
    ]


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
