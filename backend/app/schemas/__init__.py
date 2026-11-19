"""Pydantic request/response models used by the DevSync API.

Field names are declared snake_case to match the ORM and serialized as camelCase on
the wire (see `CamelModel`). This keeps Python code idiomatic while matching the
frontend's `frontend/src/lib/types.ts` without manual transforms.
"""

from app.schemas.activity import ActivityItemRead
from app.schemas.base import CamelModel
from app.schemas.dashboard import DashboardResponse
from app.schemas.deliverable import DeliverableInput, DeliverableRead
from app.schemas.integration import (
    DiscordConnect,
    DiscordInvite,
    GitHubConnect,
    GitHubInstallUrl,
    GitHubIntegrationRead,
    GitHubRepositoryRead,
    GitHubRepositorySelect,
    IntegrationStatusRead,
    SyncResultRead,
)
from app.schemas.milestone import MilestoneInput, MilestoneRead
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.summary import (
    GeneratedProjectSummary,
    ProjectSummaryContext,
    SummaryClaim,
    SummaryRead,
)

__all__ = [
    "ActivityItemRead",
    "CamelModel",
    "DashboardResponse",
    "DeliverableInput",
    "DeliverableRead",
    "DiscordConnect",
    "DiscordInvite",
    "GeneratedProjectSummary",
    "GitHubConnect",
    "GitHubInstallUrl",
    "GitHubIntegrationRead",
    "GitHubRepositoryRead",
    "GitHubRepositorySelect",
    "IntegrationStatusRead",
    "MilestoneInput",
    "MilestoneRead",
    "ProjectCreate",
    "ProjectRead",
    "ProjectSummaryContext",
    "ProjectUpdate",
    "SummaryClaim",
    "SummaryRead",
    "SyncResultRead",
]
