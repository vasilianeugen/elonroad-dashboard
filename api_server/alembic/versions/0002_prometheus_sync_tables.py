"""prometheus sync tables

Revision ID: 0002_prometheus_sync_tables
Revises: 0001_initial_schema
Create Date: 2026-05-20 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002_prometheus_sync_tables"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "prometheus_instances",
        sa.Column("instance", sa.Text(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("labels", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("instance"),
    )
    op.create_index("ix_prometheus_instances_last_seen_at", "prometheus_instances", ["last_seen_at"])

    op.create_table(
        "prometheus_metric_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("instance", sa.Text(), nullable=False),
        sa.Column("metric_name", sa.Text(), nullable=False),
        sa.Column("sampled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("value", sa.Numeric(20, 6), nullable=False),
        sa.Column("labels", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_prometheus_metric_snapshots_instance", "prometheus_metric_snapshots", ["instance"])
    op.create_index("ix_prometheus_metric_snapshots_metric_name", "prometheus_metric_snapshots", ["metric_name"])
    op.create_index("ix_prometheus_metric_snapshots_sampled_at", "prometheus_metric_snapshots", ["sampled_at"])
    op.create_index(
        "ix_prometheus_metric_snapshots_instance_metric_sampled",
        "prometheus_metric_snapshots",
        ["instance", "metric_name", "sampled_at"],
    )

    op.create_table(
        "background_sync_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("rows_written", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_background_sync_runs_source_started", "background_sync_runs", ["source", "started_at"])


def downgrade() -> None:
    op.drop_index("ix_background_sync_runs_source_started", table_name="background_sync_runs")
    op.drop_table("background_sync_runs")
    op.drop_index("ix_prometheus_metric_snapshots_instance_metric_sampled", table_name="prometheus_metric_snapshots")
    op.drop_index("ix_prometheus_metric_snapshots_sampled_at", table_name="prometheus_metric_snapshots")
    op.drop_index("ix_prometheus_metric_snapshots_metric_name", table_name="prometheus_metric_snapshots")
    op.drop_index("ix_prometheus_metric_snapshots_instance", table_name="prometheus_metric_snapshots")
    op.drop_table("prometheus_metric_snapshots")
    op.drop_index("ix_prometheus_instances_last_seen_at", table_name="prometheus_instances")
    op.drop_table("prometheus_instances")
