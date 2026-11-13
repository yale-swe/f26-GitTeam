"""add structured summary output

The summary provider already returns validated, evidence-backed sections for
blockers and next steps. Preserve that structure beside the rendered text so
the dashboard can consume it later without making another provider request.

Revision ID: e3a1b7c9d2f4
Revises: fc6d790fb76c
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e3a1b7c9d2f4"
down_revision: str | None = "fc6d790fb76c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "summaries",
        sa.Column("structured_output", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("summaries", "structured_output")
