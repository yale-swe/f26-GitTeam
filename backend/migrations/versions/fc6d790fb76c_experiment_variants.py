"""experiment variants

Stores view and click counts per version of a UI experiment, used by the
multi-armed bandit that picks which landing-page button color to show.

Revision ID: fc6d790fb76c
Revises: c4d8e1f20a63
Create Date: 2026-11-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "fc6d790fb76c"
down_revision: str | None = "c4d8e1f20a63"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "experiment_variants",
        sa.Column("experiment", sa.String(64), primary_key=True),
        sa.Column("variant", sa.String(64), primary_key=True),
        sa.Column("views", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute("ALTER TABLE experiment_variants ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.drop_table("experiment_variants")
