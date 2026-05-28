"""remove_non_matching_fabric_data

Revision ID: 5e904223d61e
Revises: 0006_add_tenant_key
Create Date: 2026-05-28 10:54:14.469280
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '5e904223d61e'
down_revision: str | None = '0006_add_tenant_key'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    import os
    tenant_key = os.environ.get("DATA_TENANT_KEY", "its-standard-preview")
    op.execute(f"""
        DELETE FROM loki_vehicle_snapshots
        WHERE unit = 'fabric.eventstream'
          AND tenant_key = '{tenant_key}'
          AND NOT (
            (payload->'FabricEvent'->>'Name' LIKE 'EnergyNetworkTransferSessionsEvent_%')
            OR (payload->>'FabricEvent' LIKE 'EnergyNetworkTransferSessionsEvent_%')
            OR (payload::text LIKE '%TransferSession%')
          )
    """)


def downgrade() -> None:
    pass
