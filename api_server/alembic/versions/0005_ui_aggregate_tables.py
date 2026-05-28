"""ui aggregate tables

Revision ID: 0005_ui_aggregate_tables
Revises: 0004_loki_vehicle_snapshots
Create Date: 2026-05-20 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0005_ui_aggregate_tables"
down_revision: str | None = "0004_loki_vehicle_snapshots"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("daily_energy_aggregates", sa.Column("active_vehicles", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("daily_energy_aggregates", sa.Column("active_chargers", sa.Integer(), nullable=False, server_default="0"))
    op.add_column(
        "daily_energy_aggregates",
        sa.Column("source_breakdown", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )

    op.create_table(
        "charging_session_summaries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("host_name", sa.Text(), nullable=True),
        sa.Column("session_id", sa.Text(), nullable=False),
        sa.Column("vehicle_id", sa.Text(), nullable=True),
        sa.Column("vehicle_name", sa.Text(), nullable=True),
        sa.Column("vehicle_type", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Numeric(12, 2), nullable=False),
        sa.Column("energy_kwh", sa.Numeric(14, 4), nullable=False),
        sa.Column("meter_start_wh", sa.Numeric(20, 6), nullable=True),
        sa.Column("meter_end_wh", sa.Numeric(20, 6), nullable=True),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.Column("state_counts", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "session_id", "vehicle_id", name="uq_charging_session_summaries_source_session_vehicle"),
    )
    op.create_index("ix_charging_session_summaries_started", "charging_session_summaries", ["started_at"])
    op.create_index("ix_charging_session_summaries_vehicle", "charging_session_summaries", ["vehicle_id"])

    op.create_table(
        "vehicle_daily_aggregates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("host_name", sa.Text(), nullable=True),
        sa.Column("vehicle_id", sa.Text(), nullable=False),
        sa.Column("vehicle_name", sa.Text(), nullable=True),
        sa.Column("vehicle_type", sa.Text(), nullable=True),
        sa.Column("total_sessions", sa.Integer(), nullable=False),
        sa.Column("total_energy_kwh", sa.Numeric(14, 4), nullable=False),
        sa.Column("average_duration_minutes", sa.Numeric(12, 2), nullable=False),
        sa.Column("max_meter_current_a", sa.Numeric(20, 6), nullable=True),
        sa.Column("average_battery_soc_percent", sa.Numeric(10, 4), nullable=True),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_date", "source", "vehicle_id", name="uq_vehicle_daily_aggregates_date_source_vehicle"),
    )
    op.create_index("ix_vehicle_daily_aggregates_date", "vehicle_daily_aggregates", ["event_date"])

    op.create_table(
        "charger_daily_aggregates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("host_name", sa.Text(), nullable=True),
        sa.Column("charger_id", sa.Text(), nullable=False),
        sa.Column("charger_name", sa.Text(), nullable=True),
        sa.Column("total_sessions", sa.Integer(), nullable=False),
        sa.Column("total_energy_kwh", sa.Numeric(14, 4), nullable=False),
        sa.Column("average_duration_minutes", sa.Numeric(12, 2), nullable=False),
        sa.Column("sample_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_date", "source", "charger_id", name="uq_charger_daily_aggregates_date_source_charger"),
    )
    op.create_index("ix_charger_daily_aggregates_date", "charger_daily_aggregates", ["event_date"])

    op.alter_column("daily_energy_aggregates", "active_vehicles", server_default=None)
    op.alter_column("daily_energy_aggregates", "active_chargers", server_default=None)
    op.alter_column("daily_energy_aggregates", "source_breakdown", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_charger_daily_aggregates_date", table_name="charger_daily_aggregates")
    op.drop_table("charger_daily_aggregates")
    op.drop_index("ix_vehicle_daily_aggregates_date", table_name="vehicle_daily_aggregates")
    op.drop_table("vehicle_daily_aggregates")
    op.drop_index("ix_charging_session_summaries_vehicle", table_name="charging_session_summaries")
    op.drop_index("ix_charging_session_summaries_started", table_name="charging_session_summaries")
    op.drop_table("charging_session_summaries")
    op.drop_column("daily_energy_aggregates", "source_breakdown")
    op.drop_column("daily_energy_aggregates", "active_chargers")
    op.drop_column("daily_energy_aggregates", "active_vehicles")
