"""add tenant key

Revision ID: 0006_add_tenant_key
Revises: 0005_ui_aggregate_tables
Create Date: 2026-05-28 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0006_add_tenant_key"
down_revision: str | None = "0005_ui_aggregate_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


TABLES = [
    "background_sync_runs",
    "charger_daily_aggregates",
    "charging_session_summaries",
    "daily_energy_aggregates",
    "loki_vehicle_snapshots",
    "prometheus_instances",
    "prometheus_metric_snapshots",
    "vehicle_daily_aggregates",
]


def upgrade() -> None:
    for table_name in TABLES:
        op.add_column(
            table_name,
            sa.Column("tenant_key", sa.Text(), nullable=False, server_default="loki"),
        )

    op.drop_constraint("uq_daily_energy_aggregates_event_date", "daily_energy_aggregates", type_="unique")
    op.create_unique_constraint(
        "uq_daily_energy_aggregates_tenant_event_date",
        "daily_energy_aggregates",
        ["tenant_key", "event_date"],
    )

    op.drop_constraint(
        "uq_charging_session_summaries_source_session_vehicle",
        "charging_session_summaries",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_charging_session_summaries_tenant_source_session_vehicle",
        "charging_session_summaries",
        ["tenant_key", "source", "session_id", "vehicle_id"],
    )

    op.drop_constraint(
        "uq_vehicle_daily_aggregates_date_source_vehicle",
        "vehicle_daily_aggregates",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_vehicle_daily_aggregates_tenant_date_source_vehicle",
        "vehicle_daily_aggregates",
        ["tenant_key", "event_date", "source", "vehicle_id"],
    )

    op.drop_constraint(
        "uq_charger_daily_aggregates_date_source_charger",
        "charger_daily_aggregates",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_charger_daily_aggregates_tenant_date_source_charger",
        "charger_daily_aggregates",
        ["tenant_key", "event_date", "source", "charger_id"],
    )

    op.drop_constraint("uq_loki_vehicle_snapshots_line_hash", "loki_vehicle_snapshots", type_="unique")
    op.create_unique_constraint(
        "uq_loki_vehicle_snapshots_tenant_line_hash",
        "loki_vehicle_snapshots",
        ["tenant_key", "line_hash"],
    )

    op.drop_constraint("prometheus_instances_pkey", "prometheus_instances", type_="primary")
    op.create_primary_key("prometheus_instances_pkey", "prometheus_instances", ["tenant_key", "instance"])

    for table_name in TABLES:
        op.alter_column(table_name, "tenant_key", server_default=None)


def downgrade() -> None:
    for table_name in TABLES:
        op.alter_column(table_name, "tenant_key", server_default="loki")

    op.drop_constraint("prometheus_instances_pkey", "prometheus_instances", type_="primary")
    op.create_primary_key("prometheus_instances_pkey", "prometheus_instances", ["instance"])

    op.drop_constraint("uq_loki_vehicle_snapshots_tenant_line_hash", "loki_vehicle_snapshots", type_="unique")
    op.create_unique_constraint(
        "uq_loki_vehicle_snapshots_line_hash",
        "loki_vehicle_snapshots",
        ["line_hash"],
    )

    op.drop_constraint(
        "uq_charger_daily_aggregates_tenant_date_source_charger",
        "charger_daily_aggregates",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_charger_daily_aggregates_date_source_charger",
        "charger_daily_aggregates",
        ["event_date", "source", "charger_id"],
    )

    op.drop_constraint(
        "uq_vehicle_daily_aggregates_tenant_date_source_vehicle",
        "vehicle_daily_aggregates",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_vehicle_daily_aggregates_date_source_vehicle",
        "vehicle_daily_aggregates",
        ["event_date", "source", "vehicle_id"],
    )

    op.drop_constraint(
        "uq_charging_session_summaries_tenant_source_session_vehicle",
        "charging_session_summaries",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_charging_session_summaries_source_session_vehicle",
        "charging_session_summaries",
        ["source", "session_id", "vehicle_id"],
    )

    op.drop_constraint("uq_daily_energy_aggregates_tenant_event_date", "daily_energy_aggregates", type_="unique")
    op.create_unique_constraint(
        "uq_daily_energy_aggregates_event_date",
        "daily_energy_aggregates",
        ["event_date"],
    )

    for table_name in reversed(TABLES):
        op.drop_column(table_name, "tenant_key")
