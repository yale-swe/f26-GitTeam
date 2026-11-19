"""Milestone progress derived from deliverable status."""

from collections.abc import Sequence
from typing import Protocol

from app.models.enums import DeliverableStatus, MilestoneStatus


class DeliverableEvidence(Protocol):
    status: DeliverableStatus


def calculate_progress(deliverables: Sequence[DeliverableEvidence]) -> tuple[int, int, int]:
    """Return (completed, total, percent); percent is 0 when there are no deliverables."""

    total = len(deliverables)
    completed = sum(1 for d in deliverables if d.status == DeliverableStatus.COMPLETED)
    percent = round(completed * 100 / total) if total else 0
    return completed, total, percent


def all_deliverables_completed(deliverables: Sequence[DeliverableEvidence]) -> bool:
    """True when the milestone has deliverables and every one is completed."""

    completed, total, _ = calculate_progress(deliverables)
    return total > 0 and completed == total


def status_after_deliverable_change(
    current: MilestoneStatus, deliverables: Sequence[DeliverableEvidence]
) -> MilestoneStatus:
    """Milestone status once its deliverables have changed.

    With deliverables, their completion decides whether the milestone is done:
    all complete means completed, and a completed milestone with an open
    deliverable goes back to in progress. Planned and at-risk milestones are left
    alone while anything is open, and milestones without deliverables stay manual.
    """

    if not deliverables:
        return current
    if all_deliverables_completed(deliverables):
        return MilestoneStatus.COMPLETED
    if current == MilestoneStatus.COMPLETED:
        return MilestoneStatus.IN_PROGRESS
    return current
