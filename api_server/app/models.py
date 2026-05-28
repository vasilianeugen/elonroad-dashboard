from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Index, Numeric, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TenantMixin:
    tenant_key: Mapped[str] = mapped_column(Text, nullable=False)


class DailyEnergyAggregate(TenantMixin, TimestampMixin, Base):
    __tablename__ = "daily_energy_aggregates"
    __table_args__ = (UniqueConstraint("tenant_key", "event_date", name="uq_daily_energy_aggregates_tenant_event_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_sessions: Mapped[int] = mapped_column(nullable=False, default=0)
    total_energy_kwh: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    average_duration_minutes: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    active_vehicles: Mapped[int] = mapped_column(nullable=False, default=0)
    active_chargers: Mapped[int] = mapped_column(nullable=False, default=0)
    source_breakdown: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class ChargingSessionSummary(TenantMixin, TimestampMixin, Base):
    __tablename__ = "charging_session_summaries"
    __table_args__ = (
        UniqueConstraint("tenant_key", "source", "session_id", "vehicle_id", name="uq_charging_session_summaries_tenant_source_session_vehicle"),
        Index("ix_charging_session_summaries_started", "started_at"),
        Index("ix_charging_session_summaries_vehicle", "vehicle_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    host_name: Mapped[str | None] = mapped_column(Text)
    session_id: Mapped[str] = mapped_column(Text, nullable=False)
    vehicle_id: Mapped[str | None] = mapped_column(Text)
    vehicle_name: Mapped[str | None] = mapped_column(Text)
    vehicle_type: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    energy_kwh: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    meter_start_wh: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    meter_end_wh: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    sample_count: Mapped[int] = mapped_column(nullable=False, default=0)
    state_counts: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class VehicleDailyAggregate(TenantMixin, TimestampMixin, Base):
    __tablename__ = "vehicle_daily_aggregates"
    __table_args__ = (
        UniqueConstraint("tenant_key", "event_date", "source", "vehicle_id", name="uq_vehicle_daily_aggregates_tenant_date_source_vehicle"),
        Index("ix_vehicle_daily_aggregates_date", "event_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    host_name: Mapped[str | None] = mapped_column(Text)
    vehicle_id: Mapped[str] = mapped_column(Text, nullable=False)
    vehicle_name: Mapped[str | None] = mapped_column(Text)
    vehicle_type: Mapped[str | None] = mapped_column(Text)
    total_sessions: Mapped[int] = mapped_column(nullable=False, default=0)
    total_energy_kwh: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    average_duration_minutes: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    max_meter_current_a: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    average_battery_soc_percent: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    sample_count: Mapped[int] = mapped_column(nullable=False, default=0)


class ChargerDailyAggregate(TenantMixin, TimestampMixin, Base):
    __tablename__ = "charger_daily_aggregates"
    __table_args__ = (
        UniqueConstraint("tenant_key", "event_date", "source", "charger_id", name="uq_charger_daily_aggregates_tenant_date_source_charger"),
        Index("ix_charger_daily_aggregates_date", "event_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    host_name: Mapped[str | None] = mapped_column(Text)
    charger_id: Mapped[str] = mapped_column(Text, nullable=False)
    charger_name: Mapped[str | None] = mapped_column(Text)
    total_sessions: Mapped[int] = mapped_column(nullable=False, default=0)
    total_energy_kwh: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    average_duration_minutes: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    sample_count: Mapped[int] = mapped_column(nullable=False, default=0)


class PrometheusInstance(TimestampMixin, Base):
    __tablename__ = "prometheus_instances"

    tenant_key: Mapped[str] = mapped_column(Text, primary_key=True)
    instance: Mapped[str] = mapped_column(Text, primary_key=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    labels: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class PrometheusMetricSnapshot(TenantMixin, TimestampMixin, Base):
    __tablename__ = "prometheus_metric_snapshots"
    __table_args__ = (
        Index(
            "ix_prometheus_metric_snapshots_instance_metric_sampled",
            "instance",
            "metric_name",
            "sampled_at",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    instance: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    metric_name: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    sampled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    value: Mapped[Decimal] = mapped_column(Numeric(20, 6), nullable=False)
    labels: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class LokiVehicleSnapshot(TenantMixin, TimestampMixin, Base):
    __tablename__ = "loki_vehicle_snapshots"
    __table_args__ = (
        UniqueConstraint("tenant_key", "line_hash", name="uq_loki_vehicle_snapshots_tenant_line_hash"),
        Index("ix_loki_vehicle_snapshots_host_sampled", "host_name", "sampled_at"),
        Index("ix_loki_vehicle_snapshots_session", "session_id"),
        Index("ix_loki_vehicle_snapshots_topic_device", "topic_device_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    line_hash: Mapped[str] = mapped_column(Text, nullable=False)
    host_name: Mapped[str] = mapped_column(Text, index=True, nullable=False)
    unit: Mapped[str] = mapped_column(Text, nullable=False)
    sampled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    topic: Mapped[str | None] = mapped_column(Text)
    topic_device_id: Mapped[str | None] = mapped_column(Text)
    session_id: Mapped[str | None] = mapped_column(Text)
    session_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    vehicle_name: Mapped[str | None] = mapped_column(Text)
    vehicle_type: Mapped[str | None] = mapped_column(Text)
    energy_link_state: Mapped[str | None] = mapped_column(Text)
    device_state: Mapped[str | None] = mapped_column(Text)
    meter_total_input_wh: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    meter_total_output_wh: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    meter_voltage_v: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    meter_current_a: Mapped[Decimal | None] = mapped_column(Numeric(20, 6))
    battery_soc_percent: Mapped[Decimal | None] = mapped_column(Numeric(10, 4))
    labels: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class BackgroundSyncRun(TenantMixin, TimestampMixin, Base):
    __tablename__ = "background_sync_runs"
    __table_args__ = (Index("ix_background_sync_runs_source_started", "source", "started_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    message: Mapped[str | None] = mapped_column(Text)
    rows_written: Mapped[int] = mapped_column(nullable=False, default=0)
