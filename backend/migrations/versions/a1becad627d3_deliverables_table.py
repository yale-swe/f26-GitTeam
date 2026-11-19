"""deliverables table

Deliverables are promoted from a bare `TEXT[]` column on `projects` to a
first-class table keyed by milestone, so the frontend progress bar and the
project health score can count completed vs. total deliverables.

Revision ID: a1becad627d3
Revises: 8c1e6b4a0f22
Create Date: 2026-11-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1becad627d3"
down_revision: str | None = "8c1e6b4a0f22"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DELIVERABLE_STATUS = ("planned", "in_progress", "completed", "blocked")


def upgrade() -> None:
    deliverable_status = postgresql.ENUM(*DELIVERABLE_STATUS, name="deliverable_status")
    deliverable_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "deliverables",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "milestone_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("milestones.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(*DELIVERABLE_STATUS, name="deliverable_status", create_type=False),
            nullable=False,
            server_default="planned",
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
    op.create_index("ix_deliverables_project_id", "deliverables", ["project_id"])
    op.create_index("ix_deliverables_milestone_id", "deliverables", ["milestone_id"])

    # The old TEXT[] column held just names, which can't carry status or a
    # milestone link. Nothing production depends on it yet, so drop it rather
    # than carry a dead column forward.
    op.drop_column("projects", "deliverables")


def downgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "deliverables",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
    )

    op.drop_index("ix_deliverables_milestone_id", table_name="deliverables")
    op.drop_index("ix_deliverables_project_id", table_name="deliverables")
    op.drop_table("deliverables")

    postgresql.ENUM(name="deliverable_status").drop(op.get_bind(), checkfirst=True)
