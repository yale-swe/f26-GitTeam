from enum import StrEnum

from sqlalchemy import Enum


class MilestoneStatus(StrEnum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    AT_RISK = "at_risk"


class IntegrationProvider(StrEnum):
    GITHUB = "github"
    DISCORD = "discord"


class IntegrationState(StrEnum):
    CONNECTED = "connected"
    SYNCING = "syncing"
    HEALTHY = "healthy"
    STALE = "stale"
    FAILED = "failed"


class HealthStatus(StrEnum):
    HEALTHY = "healthy"
    AT_RISK = "at_risk"
    BLOCKED = "blocked"
    UNKNOWN = "unknown"


class AnalysisStatus(StrEnum):
    CURRENT = "current"
    STALE = "stale"
    UNAVAILABLE = "unavailable"


class DeliverableStatus(StrEnum):
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"


class ProjectRole(StrEnum):
    OWNER = "owner"
    MEMBER = "member"


milestone_status_type = Enum(
    MilestoneStatus,
    name="milestone_status",
    values_callable=lambda e: [m.value for m in e],
)
deliverable_status_type = Enum(
    DeliverableStatus,
    name="deliverable_status",
    values_callable=lambda e: [m.value for m in e],
)
integration_provider_type = Enum(
    IntegrationProvider,
    name="integration_provider",
    values_callable=lambda e: [m.value for m in e],
)
integration_state_type = Enum(
    IntegrationState,
    name="integration_state",
    values_callable=lambda e: [m.value for m in e],
)
project_role_type = Enum(
    ProjectRole,
    name="project_role",
    values_callable=lambda e: [m.value for m in e],
)
