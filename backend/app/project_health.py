"""Deterministic project-health scoring from current project evidence.

The score deliberately uses only data that DevSync already stores: milestone
status/deadlines, normalized integration activity, known blockers, and
integration state. Generated summaries and raw commit/message counts are not
scored because they are either derived or too easy to misinterpret.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from math import floor
from typing import Protocol

from app.models.enums import (
    HealthStatus,
    IntegrationProvider,
    IntegrationState,
    MilestoneStatus,
)

MILESTONE_WEIGHT = 0.50
BLOCKER_WEIGHT = 0.30
ACTIVITY_WEIGHT = 0.20


class MilestoneEvidence(Protocol):
    title: str
    due_at: datetime
    status: MilestoneStatus


class IntegrationEvidence(Protocol):
    provider: IntegrationProvider
    status: IntegrationState


class ActivityEvidence(Protocol):
    source: IntegrationProvider
    occurred_at: datetime


@dataclass(frozen=True)
class HealthAssessment:
    score: int | None
    status: HealthStatus


def calculate_project_health(
    *,
    milestones: Sequence[MilestoneEvidence],
    blockers: Sequence[str],
    activity: Sequence[ActivityEvidence],
    integrations: Sequence[IntegrationEvidence],
    now: datetime | None = None,
) -> HealthAssessment:
    """Return a stable 0-100 score; exclude unavailable or stale integration data."""

    now = _as_utc(now or datetime.now(UTC))
    milestone_score = _score_milestones(milestones, now)

    current_sources = {
        IntegrationProvider(item.provider)
        for item in integrations
        if IntegrationState(item.status) == IntegrationState.HEALTHY
    }
    discord_is_current = IntegrationProvider.DISCORD in current_sources
    if discord_is_current:
        blocker_score = max(0, 100 - 15 * len(blockers))
    else:
        blocker_score = None

    current_activity = [item for item in activity if item.source in current_sources]
    activity_score = _score_activity(current_activity, current_sources, now)

    if milestone_score is None or activity_score is None:
        return HealthAssessment(score=None, status=HealthStatus.UNKNOWN)

    components = (
        (milestone_score, MILESTONE_WEIGHT),
        (blocker_score, BLOCKER_WEIGHT),
        (activity_score, ACTIVITY_WEIGHT),
    )
    available = [(value, weight) for value, weight in components if value is not None]
    available_weight = sum(weight for _, weight in available)
    score = _round_score(sum(value * weight for value, weight in available) / available_weight)

    has_overdue_milestone = any(
        MilestoneStatus(item.status) != MilestoneStatus.COMPLETED and _as_utc(item.due_at) < now
        for item in milestones
    )
    if has_overdue_milestone or score < 50:
        status = HealthStatus.BLOCKED
    elif score < 80:
        status = HealthStatus.AT_RISK
    else:
        status = HealthStatus.HEALTHY

    return HealthAssessment(score=score, status=status)


def _score_milestones(milestones: Sequence[MilestoneEvidence], now: datetime) -> int | None:
    if not milestones:
        return None

    open_milestones = sorted(
        (item for item in milestones if MilestoneStatus(item.status) != MilestoneStatus.COMPLETED),
        key=lambda item: _as_utc(item.due_at),
    )
    if not open_milestones:
        return 100

    relevant = open_milestones[:2]
    weights = (1.0,) if len(relevant) == 1 else (0.7, 0.3)
    scores = [_score_one_milestone(item, now) for item in relevant]
    return _round_score(sum(value * weight for value, weight in zip(scores, weights, strict=True)))


def _score_one_milestone(milestone: MilestoneEvidence, now: datetime) -> int:
    status = MilestoneStatus(milestone.status)
    base = {
        MilestoneStatus.PLANNED: 80,
        MilestoneStatus.IN_PROGRESS: 90,
        MilestoneStatus.AT_RISK: 55,
        MilestoneStatus.COMPLETED: 100,
    }[status]
    days = (_as_utc(milestone.due_at) - now).total_seconds() / 86_400
    if status == MilestoneStatus.COMPLETED:
        penalty = 0
    elif days < 0:
        penalty = 50
    elif days <= 3:
        penalty = 20
    elif days <= 7:
        penalty = 10
    elif days <= 14:
        penalty = 5
    else:
        penalty = 0
    return max(0, base - penalty)


def _score_activity(
    activity: Sequence[ActivityEvidence],
    current_sources: set[IntegrationProvider],
    now: datetime,
) -> int | None:
    if not current_sources:
        return None

    source_scores: list[int] = []
    for source in current_sources:
        source_activity = [item for item in activity if item.source == source]
        if not source_activity:
            source_scores.append(0)
            continue
        latest = max(_as_utc(item.occurred_at) for item in source_activity)
        age_days = max(0.0, (now - latest).total_seconds() / 86_400)
        if age_days <= 3:
            source_scores.append(100)
        elif age_days <= 7:
            source_scores.append(80)
        elif age_days <= 14:
            source_scores.append(50)
        elif age_days <= 30:
            source_scores.append(25)
        else:
            source_scores.append(0)

    return _round_score(sum(source_scores) / len(source_scores))


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _round_score(value: float) -> int:
    """Round non-negative scores conventionally so .5 is visible as progress."""

    return floor(value + 0.5)
