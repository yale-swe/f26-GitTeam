"""Generate, render, and persist validated project progress summaries."""

import uuid
from collections.abc import Callable, Sequence

from sqlalchemy.orm import Session

from app.integrations.openrouter import generate_project_summary
from app.models.summary import Summary
from app.schemas.summary import GeneratedProjectSummary, ProjectSummaryContext, SummaryClaim
from app.services.summary_context import build_summary_context

SummaryGenerator = Callable[[ProjectSummaryContext], GeneratedProjectSummary]


def generate_and_store_summary(
    db: Session,
    project_id: uuid.UUID,
    *,
    generator: SummaryGenerator | None = None,
) -> Summary:
    """Store a new summary only after generation and validation have succeeded."""

    context = build_summary_context(db, project_id)
    generated = (generator or generate_project_summary)(context)
    summary = Summary(
        project_id=project_id,
        text=render_summary(generated),
        structured_output=generated.model_dump(mode="json", by_alias=True),
    )
    db.add(summary)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(summary)
    return summary


def render_summary(summary: GeneratedProjectSummary) -> str:
    """Render validated structured output into the MVP's stored text format."""

    sections = [
        _render_claims("Recent progress", summary.recent_progress),
        _render_claims("Upcoming milestones", summary.upcoming_milestones),
        _render_claims("Notable activity", summary.notable_activity),
        _render_claims("Blockers", summary.blockers),
        _render_claims("Next steps", summary.next_steps),
        _render_limitations(summary.limitations),
    ]
    return "\n\n".join(sections)


def _render_claims(title: str, claims: Sequence[SummaryClaim]) -> str:
    if not claims:
        return f"{title}:\n- No supported information available."
    lines = [f"- {claim.text} [Evidence: {', '.join(claim.evidence_ids)}]" for claim in claims]
    return f"{title}:\n" + "\n".join(lines)


def _render_limitations(limitations: Sequence[str]) -> str:
    if not limitations:
        return "Limitations:\n- None."
    return "Limitations:\n" + "\n".join(f"- {item}" for item in limitations)
