"""initial schema

Projects, milestones, integrations, activity items, summaries.

Revision ID: d27040751aae
Revises:
Create Date: 2026-10-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d27040751aae"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


MILESTONE_STATUS = ("planned", "in_progress", "completed", "at_risk")
INTEGRATION_PROVIDER = ("github", "discord")
INTEGRATION_STATE = ("connected", "syncing", "healthy", "stale", "failed")


def upgrade() -> None:
    milestone_status = postgresql.ENUM(*MILESTONE_STATUS, name="milestone_status")
    integration_provider = postgresql.ENUM(*INTEGRATION_PROVIDER, name="integration_provider")
    integration_state = postgresql.ENUM(*INTEGRATION_STATE, name="integration_state")

    bind = op.get_bind()
    milestone_status.create(bind, checkfirst=True)
    integration_provider.create(bind, checkfirst=True)
    integration_state.create(bind, checkfirst=True)

    op.create_table(
        "projects",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.String(), nullable=False),
        sa.Column(
            "features",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "deliverables",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "milestones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(*MILESTONE_STATUS, name="milestone_status", create_type=False),
            nullable=False,
            server_default="planned",
        ),
    )
    op.create_index("ix_milestones_project_id", "milestones", ["project_id"])

    op.create_table(
        "integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "provider",
            postgresql.ENUM(*INTEGRATION_PROVIDER, name="integration_provider", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            postgresql.ENUM(*INTEGRATION_STATE, name="integration_state", create_type=False),
            nullable=False,
            server_default="connected",
        ),
        sa.Column(
            "config",
            postgresql.JSONB(),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("last_successful_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_error", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_integrations_project_id", "integrations", ["project_id"])

    op.create_table(
        "activity_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source",
            postgresql.ENUM(*INTEGRATION_PROVIDER, name="integration_provider", create_type=False),
            nullable=False,
        ),
        sa.Column("source_id", sa.String(length=255), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("project_id", "source", "source_id", name="uq_activity_items_source"),
    )
    op.create_index("ix_activity_items_project_id", "activity_items", ["project_id"])
    op.create_index("ix_activity_items_occurred_at", "activity_items", ["occurred_at"])

    op.create_table(
        "summaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("text", sa.String(), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_summaries_project_id", "summaries", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_summaries_project_id", table_name="summaries")
    op.drop_table("summaries")

    op.drop_index("ix_activity_items_occurred_at", table_name="activity_items")
    op.drop_index("ix_activity_items_project_id", table_name="activity_items")
    op.drop_table("activity_items")

    op.drop_index("ix_integrations_project_id", table_name="integrations")
    op.drop_table("integrations")

    op.drop_index("ix_milestones_project_id", table_name="milestones")
    op.drop_table("milestones")

    op.drop_table("projects")

    bind = op.get_bind()
    postgresql.ENUM(name="integration_state").drop(bind, checkfirst=True)
    postgresql.ENUM(name="integration_provider").drop(bind, checkfirst=True)
    postgresql.ENUM(name="milestone_status").drop(bind, checkfirst=True)
