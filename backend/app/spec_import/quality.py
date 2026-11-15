from datetime import date

from app.spec_import.schemas import ExtractedPlan


def check_plan(plan: ExtractedPlan, source_text: str, today: date) -> list[str]:
    """Warn about extracted items the model may have invented or guessed wrong."""
    warnings: list[str] = []
    source = _normalize(source_text)

    if plan.name.strip() and not _appears_in(plan.name, source):
        warnings.append(_not_found("Project name", plan.name))

    for feature in plan.features:
        if not _appears_in(feature, source):
            warnings.append(_not_found("Feature", feature))

    for milestone in plan.milestones:
        if not _appears_in(milestone.title, source):
            warnings.append(_not_found("Milestone", milestone.title))
        past = _past_date_warning(milestone.title, milestone.date, today)
        if past:
            warnings.append(past)
        for deliverable in milestone.deliverables:
            if not _appears_in(deliverable, source):
                warnings.append(_not_found("Deliverable", deliverable))

    return warnings


def _not_found(kind: str, item: str) -> str:
    return f"{kind} '{item}' wasn't found in the document; check it wasn't invented."


def _past_date_warning(title: str, value: str | None, today: date) -> str | None:
    """A past date usually means the model guessed the wrong year."""
    if value is None:
        return None
    try:
        due = date.fromisoformat(value)
    except ValueError:
        return None  # missing or invalid dates are caught by the plan form
    if due < today:
        return f"Milestone '{title}' is dated {value}, which is in the past; check the year."
    return None


def _appears_in(item: str, normalized_source: str) -> bool:
    normalized = _normalize(item)
    return bool(normalized) and normalized in normalized_source


def _normalize(text: str) -> str:
    return " ".join(text.lower().split())
