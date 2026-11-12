"""Read the latest evidence-backed project analysis without calling the LLM."""

from dataclasses import dataclass
from datetime import UTC, datetime

from pydantic import ValidationError

from app.models.enums import AnalysisStatus, IntegrationState
from app.models.project import Project
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

    if any(item.status != IntegrationState.HEALTHY for item in project.integrations):
        return ProjectAnalysisResult(status=AnalysisStatus.STALE)

    generated_at = _as_utc(summary.generated_at)
    if any(
        item.last_successful_sync_at is not None
        and _as_utc(item.last_successful_sync_at) > generated_at
        for item in project.integrations
    ):
        return ProjectAnalysisResult(status=AnalysisStatus.STALE)

    return ProjectAnalysisResult(status=AnalysisStatus.CURRENT, output=output)


def _claims_are_grounded(output: GeneratedProjectSummary, project: Project) -> bool:
    allowed = {f"project:{project.id}"}
    allowed.update(f"milestone:{item.id}" for item in project.milestones)
    allowed.update(f"deliverable:{item.id}" for item in project.deliverables)
    allowed.update(f"integration:{item.id}" for item in project.integrations)
    allowed.update(f"activity:{item.id}" for item in project.activity_items)
    cited = {evidence_id for claim in _claims(output) for evidence_id in claim.evidence_ids}
    return cited <= allowed


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
