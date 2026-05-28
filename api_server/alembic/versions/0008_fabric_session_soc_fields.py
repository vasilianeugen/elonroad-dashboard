"""fabric_session_soc_fields

Revision ID: 0008_fabric_session_soc_fields
Revises: 5e904223d61e
Create Date: 2026-05-28 13:18:00.000000
"""
from collections.abc import Sequence
import os

from alembic import op
import sqlalchemy as sa


revision: str = "0008_fabric_session_soc_fields"
down_revision: str | None = "5e904223d61e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("charging_session_summaries", sa.Column("start_soc_percent", sa.Numeric(10, 4), nullable=True))
    op.add_column("charging_session_summaries", sa.Column("end_soc_percent", sa.Numeric(10, 4), nullable=True))

    tenant_key = os.environ.get("DATA_TENANT_KEY", "its-standard-preview").replace("'", "''")
    op.execute(
        f"""
        DELETE FROM loki_vehicle_snapshots
        WHERE tenant_key = '{tenant_key}'
          AND unit = 'fabric.eventstream'
        """
    )


def downgrade() -> None:
    op.drop_column("charging_session_summaries", "end_soc_percent")
    op.drop_column("charging_session_summaries", "start_soc_percent")
