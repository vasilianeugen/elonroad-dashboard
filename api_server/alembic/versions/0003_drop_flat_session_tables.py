"""drop flat session tables

Revision ID: 0003_drop_flat_session_tables
Revises: 0002_prometheus_sync_tables
Create Date: 2026-05-20 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003_drop_flat_session_tables"
down_revision: str | None = "0002_prometheus_sync_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_table("charger_daily_aggregates")
    op.drop_table("vehicle_daily_aggregates")
    op.drop_table("charging_sessions")
    op.drop_table("raw_flat_rows")


def downgrade() -> None:
    op.create_table(
        "raw_flat_rows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_file", sa.Text(), nullable=True),
        sa.Column("source_line", sa.Integer(), nullable=True),
        sa.Column("row_hash", sa.Text(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("row_hash"),
    )

    op.create_table(
        "charging_sessions",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("vehicle_id", sa.Text(), nullable=False),
        sa.Column("vehicle_name", sa.Text(), nullable=True),
        sa.Column("charger_id", sa.Text(), nullable=False),
        sa.Column("charger_name", sa.Text(), nullable=True),
        sa.Column("supplied_energy_kwh", sa.Numeric(14, 4), nullable=False),
        sa.Column("received_energy_kwh", sa.Numeric(14, 4), nullable=True),
        sa.Column("duration_minutes", sa.Numeric(12, 2), nullable=False),
        sa.Column("energy_wind_kwh", sa.Numeric(14, 4), nullable=False),
        sa.Column("energy_solar_kwh", sa.Numeric(14, 4), nullable=False),
        sa.Column("energy_hydro_kwh", sa.Numeric(14, 4), nullable=False),
        sa.Column("energy_unknown_kwh", sa.Numeric(14, 4), nullable=False),
        sa.Column("raw_flat_row_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_charging_sessions_charger_id", "charging_sessions", ["charger_id"])
    op.create_index("ix_charging_sessions_event_date", "charging_sessions", ["event_date"])
    op.create_index("ix_charging_sessions_ended_at", "charging_sessions", ["ended_at"])
    op.create_index("ix_charging_sessions_raw_flat_row_id", "charging_sessions", ["raw_flat_row_id"])
    op.create_index("ix_charging_sessions_started_at", "charging_sessions", ["started_at"])
    op.create_index("ix_charging_sessions_vehicle_id", "charging_sessions", ["vehicle_id"])

    op.create_table(
        "vehicle_daily_aggregates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("vehicle_id", sa.Text(), nullable=False),
        sa.Column("vehicle_name", sa.Text(), nullable=True),
        sa.Column("total_sessions", sa.Integer(), nullable=False),
        sa.Column("total_energy_kwh", sa.Numeric(14, 4), nullable=False),
        sa.Column("average_duration_minutes", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_date", "vehicle_id", name="uq_vehicle_daily_aggregates_date_vehicle"),
    )
    op.create_index(
        "ix_vehicle_daily_aggregates_vehicle_date",
        "vehicle_daily_aggregates",
        ["vehicle_id", "event_date"],
    )

    op.create_table(
        "charger_daily_aggregates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("charger_id", sa.Text(), nullable=False),
        sa.Column("charger_name", sa.Text(), nullable=True),
        sa.Column("total_sessions", sa.Integer(), nullable=False),
        sa.Column("total_energy_kwh", sa.Numeric(14, 4), nullable=False),
        sa.Column("average_duration_minutes", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_date", "charger_id", name="uq_charger_daily_aggregates_date_charger"),
    )
    op.create_index(
        "ix_charger_daily_aggregates_charger_date",
        "charger_daily_aggregates",
        ["charger_id", "event_date"],
    )
