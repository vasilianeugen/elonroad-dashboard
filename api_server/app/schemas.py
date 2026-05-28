from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PrometheusMetricSnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instance: str
    metric_name: str
    sampled_at: datetime
    value: Decimal
    labels: dict


class LokiVehicleSnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    host_name: str
    unit: str
    sampled_at: datetime
    topic: str | None
    topic_device_id: str | None
    session_id: str | None
    session_started_at: datetime | None
    vehicle_name: str | None
    vehicle_type: str | None
    energy_link_state: str | None
    device_state: str | None
    meter_total_input_wh: Decimal | None
    meter_total_output_wh: Decimal | None
    meter_voltage_v: Decimal | None
    meter_current_a: Decimal | None
    battery_soc_percent: Decimal | None
    labels: dict


class BackgroundSyncRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    message: str | None
    rows_written: int


class DailyEnergyAggregateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_date: date
    total_sessions: int
    total_energy_kwh: Decimal
    average_duration_minutes: Decimal
    active_vehicles: int
    active_chargers: int
    source_breakdown: dict


class ChargingSessionSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    host_name: str | None
    session_id: str
    vehicle_id: str | None
    vehicle_name: str | None
    vehicle_type: str | None
    started_at: datetime
    ended_at: datetime
    duration_minutes: Decimal
    energy_kwh: Decimal
    meter_start_wh: Decimal | None
    meter_end_wh: Decimal | None
    sample_count: int
    state_counts: dict


class VehicleDailyAggregateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_date: date
    source: str
    host_name: str | None
    vehicle_id: str
    vehicle_name: str | None
    vehicle_type: str | None
    total_sessions: int
    total_energy_kwh: Decimal
    average_duration_minutes: Decimal
    max_meter_current_a: Decimal | None
    average_battery_soc_percent: Decimal | None
    sample_count: int


class ChargerDailyAggregateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_date: date
    source: str
    host_name: str | None
    charger_id: str
    charger_name: str | None
    total_sessions: int
    total_energy_kwh: Decimal
    average_duration_minutes: Decimal
    sample_count: int
