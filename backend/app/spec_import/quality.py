from datetime import date

from app.spec_import.schemas import ExtractedPlan


def check_plan(plan: ExtractedPlan, source_text: str, today: date) -> list[str]:
    """Return warnings the user should review before trusting the extracted plan."""
    warnings: list[str] = []
    source = _normalize(source_text)

    if not plan.name.strip():
        warnings.append("No project name was found.")
    elif not _appears_in(plan.name, source):
        warnings.append(f"Project name '{plan.name}' wasn't found in the document; ...")
    if not plan.summary.strip():
        warnings.append("No project summary was found.")
    if not plan.features:
        warnings.append("No features were found.")
    if not plan.milestones:
        warnings.append("No milestones were found.")

    for feature in plan.features:
        if not _appears_in(feature, source):
            warnings.append(
                f"Feature '{feature}' wasn't found in the document; check it wasn't invented."
            )

    for milestone in plan.milestones:
        title = milestone.title
        if not _appears_in(title, source):
            warnings.append(
                f"Milestone '{title}' wasn't found in the document; check it wasn't invented."
            )

        warnings.extend(_date_warnings(title, milestone.date, today))

        if not milestone.deliverables:
            warnings.append(f"Milestone '{title}' has no deliverables.")
        for deliverable in milestone.deliverables:
            if not _appears_in(deliverable, source):
                warnings.append(
                    f"Deliverable '{deliverable}' wasn't found in the document; "
                    "check it wasn't invented."
                )

    return warnings


def _date_warnings(title: str, value: str | None, today: date) -> list[str]:
    """Warn about a milestone date that is missing, invalid, or already past."""
    if value is None:
        return [f"Milestone '{title}' has no date in the document."]
    try:
        due = date.fromisoformat(value)
    except ValueError:
        return [f"Milestone '{title}' has an invalid date: {value}."]
    if due < today:
        return [f"Milestone '{title}' is dated {value}, which is in the past."]
    return []


def _appears_in(item: str, normalized_source: str) -> bool:
    normalized = _normalize(item)
    return bool(normalized) and normalized in normalized_source


def _normalize(text: str) -> str:
    return " ".join(text.lower().split())
