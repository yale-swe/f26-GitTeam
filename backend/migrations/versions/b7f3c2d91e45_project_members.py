"""project members

Projects had no owner, so every signed-in user could read and edit every
project. `project_members` records which Supabase users may access which
project. Existing projects get no members here; assign them with the backfill
statement in docs/supabase.md.

Revision ID: b7f3c2d91e45
Revises: a1becad627d3
Create Date: 2026-11-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b7f3c2d91e45"
down_revision: str | None = "a1becad627d3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


PROJECT_ROLE = ("owner", "member")


def upgrade() -> None:
    project_role = postgresql.ENUM(*PROJECT_ROLE, name="project_role")
    project_role.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "project_members",
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "role",
            postgresql.ENUM(*PROJECT_ROLE, name="project_role", create_type=False),
            nullable=False,
            server_default="member",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_project_members_user_id", "project_members", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_project_members_user_id", table_name="project_members")
    op.drop_table("project_members")
    postgresql.ENUM(name="project_role").drop(op.get_bind(), checkfirst=True)
