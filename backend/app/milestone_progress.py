"""Milestone progress derived from deliverable status."""

from collections.abc import Sequence
from typing import Protocol

from app.models.enums import DeliverableStatus


class DeliverableEvidence(Protocol):
    status: DeliverableStatus


def calculate_progress(deliverables: Sequence[DeliverableEvidence]) -> tuple[int, int, int]:
    """Return (completed, total, percent); percent is 0 when there are no deliverables."""

    total = len(deliverables)
    completed = sum(1 for d in deliverables if d.status == DeliverableStatus.COMPLETED)
    percent = round(completed * 100 / total) if total else 0
    return completed, total, percent
