"""ORM models for DevSync.

Importing this package registers every model on `Base.metadata`, which is what
Alembic autogenerate reads. New model modules must be re-exported here.
"""

from app.models.activity import ActivityItem
from app.models.enums import (
    IntegrationProvider,
    IntegrationState,
    MilestoneStatus,
)
from app.models.integration import Integration
from app.models.milestone import Milestone
from app.models.project import Project
from app.models.summary import Summary

__all__ = [
    "ActivityItem",
    "Integration",
    "IntegrationProvider",
    "IntegrationState",
    "Milestone",
    "MilestoneStatus",
    "Project",
    "Summary",
]
