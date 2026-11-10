"""add activity item details

Discord sync stores author, content, and attachments beside the normalized
activity columns.

Revision ID: 8c1e6b4a0f22
Revises: d27040751aae
Create Date: 2026-10-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "8c1e6b4a0f22"
down_revision: str | None = "d27040751aae"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "activity_items",
        sa.Column("details", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("activity_items", "details")
