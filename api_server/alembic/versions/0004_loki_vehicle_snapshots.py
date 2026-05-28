"""loki vehicle snapshots

Revision ID: 0004_loki_vehicle_snapshots
Revises: 0003_drop_flat_session_tables
Create Date: 2026-05-20 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004_loki_vehicle_snapshots"
down_revision: str | None = "0003_drop_flat_session_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "loki_vehicle_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("line_hash", sa.Text(), nullable=False),
        sa.Column("host_name", sa.Text(), nullable=False),
        sa.Column("unit", sa.Text(), nullable=False),
        sa.Column("sampled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("topic", sa.Text(), nullable=True),
        sa.Column("topic_device_id", sa.Text(), nullable=True),
        sa.Column("session_id", sa.Text(), nullable=True),
        sa.Column("session_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("vehicle_name", sa.Text(), nullable=True),
        sa.Column("vehicle_type", sa.Text(), nullable=True),
        sa.Column("energy_link_state", sa.Text(), nullable=True),
        sa.Column("device_state", sa.Text(), nullable=True),
        sa.Column("meter_total_input_wh", sa.Numeric(20, 6), nullable=True),
        sa.Column("meter_total_output_wh", sa.Numeric(20, 6), nullable=True),
        sa.Column("meter_voltage_v", sa.Numeric(20, 6), nullable=True),
        sa.Column("meter_current_a", sa.Numeric(20, 6), nullable=True),
        sa.Column("battery_soc_percent", sa.Numeric(10, 4), nullable=True),
        sa.Column("labels", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("line_hash", name="uq_loki_vehicle_snapshots_line_hash"),
    )
    op.create_index("ix_loki_vehicle_snapshots_host_name", "loki_vehicle_snapshots", ["host_name"])
    op.create_index("ix_loki_vehicle_snapshots_sampled_at", "loki_vehicle_snapshots", ["sampled_at"])
    op.create_index(
        "ix_loki_vehicle_snapshots_host_sampled",
        "loki_vehicle_snapshots",
        ["host_name", "sampled_at"],
    )
    op.create_index("ix_loki_vehicle_snapshots_session", "loki_vehicle_snapshots", ["session_id"])
    op.create_index("ix_loki_vehicle_snapshots_topic_device", "loki_vehicle_snapshots", ["topic_device_id"])


def downgrade() -> None:
    op.drop_index("ix_loki_vehicle_snapshots_topic_device", table_name="loki_vehicle_snapshots")
    op.drop_index("ix_loki_vehicle_snapshots_session", table_name="loki_vehicle_snapshots")
    op.drop_index("ix_loki_vehicle_snapshots_host_sampled", table_name="loki_vehicle_snapshots")
    op.drop_index("ix_loki_vehicle_snapshots_sampled_at", table_name="loki_vehicle_snapshots")
    op.drop_index("ix_loki_vehicle_snapshots_host_name", table_name="loki_vehicle_snapshots")
    op.drop_table("loki_vehicle_snapshots")
