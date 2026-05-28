from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy import func, select

from app.config import get_settings
from app.db import SessionLocal
from app.models import (
    ChargerDailyAggregate,
    ChargingSessionSummary,
    DailyEnergyAggregate,
    LokiVehicleSnapshot,
    PrometheusMetricSnapshot,
    VehicleDailyAggregate,
)


ENERGY_COUNTER_METRICS_BY_PRIORITY = [
    "elonroad_ac_energy_link_session_received_energy_joules_total",
    "elonroad_ac_dc_meter_input_joules_total",
]


@dataclass
class RebuildCounts:
    daily_rows: int = 0
    session_rows: int = 0
    vehicle_daily_rows: int = 0
    charger_daily_rows: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "daily_rows": self.daily_rows,
            "session_rows": self.session_rows,
            "vehicle_daily_rows": self.vehicle_daily_rows,
            "charger_daily_rows": self.charger_daily_rows,
        }


def rebuild_prometheus_daily_energy_aggregates(instance: str | None = None) -> dict[str, int]:
    tenant_key = get_settings().data_tenant_key
    with SessionLocal() as db:
        counts = rebuild_ui_aggregates_in_session(db, instance=instance, tenant_key=tenant_key)
        db.commit()
        return counts.as_dict()


def rebuild_prometheus_daily_energy_aggregates_in_session(
    db,
    instance: str | None = None,
    tenant_key: str | None = None,
) -> int:
    tenant_key = tenant_key or get_settings().data_tenant_key
    return rebuild_ui_aggregates_in_session(db, instance=instance, tenant_key=tenant_key).daily_rows


def rebuild_ui_aggregates_in_session(
    db,
    instance: str | None = None,
    tenant_key: str | None = None,
) -> RebuildCounts:
    tenant_key = tenant_key or get_settings().data_tenant_key
    db.query(DailyEnergyAggregate).filter(DailyEnergyAggregate.tenant_key == tenant_key).delete()
    db.query(ChargingSessionSummary).filter(ChargingSessionSummary.tenant_key == tenant_key).delete()
    db.query(VehicleDailyAggregate).filter(VehicleDailyAggregate.tenant_key == tenant_key).delete()
    db.query(ChargerDailyAggregate).filter(ChargerDailyAggregate.tenant_key == tenant_key).delete()

    counts = RebuildCounts()
    vehicle_daily_rows = _build_loki_session_and_vehicle_aggregates(db, tenant_key=tenant_key)
    charger_daily_rows = _build_prometheus_charger_daily_aggregates(db, instance=instance, tenant_key=tenant_key)
    db.flush()
    counts.session_rows = (
        db.query(ChargingSessionSummary)
        .filter(ChargingSessionSummary.tenant_key == tenant_key)
        .count()
    )
    counts.vehicle_daily_rows = vehicle_daily_rows
    counts.charger_daily_rows = charger_daily_rows
    counts.daily_rows = _build_daily_aggregates(db, tenant_key=tenant_key)
    db.flush()
    return counts


def _build_loki_session_and_vehicle_aggregates(db, tenant_key: str) -> int:
    rows = list(
        db.scalars(
            select(LokiVehicleSnapshot).where(
                LokiVehicleSnapshot.tenant_key == tenant_key,
            ).order_by(
                LokiVehicleSnapshot.session_id,
                LokiVehicleSnapshot.topic_device_id,
                LokiVehicleSnapshot.sampled_at,
            )
        ).all()
    )
    grouped: dict[tuple[str, str], list[LokiVehicleSnapshot]] = defaultdict(list)
    for row in rows:
        session_key = _loki_session_key(row)
        if not session_key:
            continue
        vehicle_id = row.topic_device_id or row.host_name
        grouped[(session_key, vehicle_id)].append(row)

    vehicle_day_accumulator: dict[tuple[date, str], dict] = {}
    for (session_id, vehicle_id), session_rows in grouped.items():
        session_rows.sort(key=lambda item: item.sampled_at)
        first = session_rows[0]
        last = session_rows[-1]
        started_at = first.session_started_at or first.sampled_at
        ended_at = _payload_transfer_session_end(last.payload) or last.sampled_at
        duration_minutes = _duration_minutes(started_at, ended_at)
        meter_values = [
            row.meter_total_input_wh
            for row in session_rows
            if row.meter_total_input_wh is not None
        ]
        meter_start = min(meter_values) if meter_values else None
        meter_end = max(meter_values) if meter_values else None
        meter_energy_kwh = Decimal("0")
        if meter_start is not None and meter_end is not None and meter_end >= meter_start:
            meter_energy_kwh = (meter_end - meter_start) / Decimal("1000")

        transfer_energy_values = [
            value
            for row in session_rows
            for value in _transfer_session_energy_wh_values(row.payload)
        ]
        transfer_energy_kwh = (
            max(transfer_energy_values) / Decimal("1000")
            if transfer_energy_values
            else Decimal("0")
        )
        energy_kwh = max(meter_energy_kwh, transfer_energy_kwh)
        if energy_kwh <= Decimal("0"):
            continue

        start_soc_percent, end_soc_percent = _session_soc_range(session_rows)

        state_counts = Counter(
            row.energy_link_state or row.device_state or "unknown"
            for row in session_rows
        )
        source = str(first.labels.get("source") or "loki") if isinstance(first.labels, dict) else "loki"
        charger_id = _session_remote_device_id(session_rows) or first.host_name
        db.add(
            ChargingSessionSummary(
                tenant_key=tenant_key,
                source=source,
                host_name=charger_id,
                session_id=session_id,
                vehicle_id=vehicle_id,
                vehicle_name=_latest_non_empty(row.vehicle_name for row in session_rows),
                vehicle_type=_latest_non_empty(row.vehicle_type for row in session_rows),
                started_at=started_at,
                ended_at=ended_at,
                duration_minutes=duration_minutes,
                energy_kwh=energy_kwh,
                start_soc_percent=start_soc_percent,
                end_soc_percent=end_soc_percent,
                meter_start_wh=meter_start,
                meter_end_wh=meter_end,
                sample_count=len(session_rows),
                state_counts=dict(state_counts),
            )
        )

        event_date = started_at.date()
        key = (event_date, vehicle_id)
        acc = vehicle_day_accumulator.setdefault(
            key,
            {
                "event_date": event_date,
                "source": source,
                "host_name": charger_id,
                "vehicle_id": vehicle_id,
                "vehicle_name": first.vehicle_name,
                "vehicle_type": first.vehicle_type,
                "total_sessions": 0,
                "total_energy_kwh": Decimal("0"),
                "duration_minutes": Decimal("0"),
                "sample_count": 0,
                "max_meter_current_a": None,
                "soc_total": Decimal("0"),
                "soc_count": 0,
            },
        )
        acc["vehicle_name"] = _latest_non_empty([acc["vehicle_name"], first.vehicle_name])
        acc["vehicle_type"] = _latest_non_empty([acc["vehicle_type"], first.vehicle_type])
        acc["total_sessions"] += 1
        acc["total_energy_kwh"] += energy_kwh
        acc["duration_minutes"] += duration_minutes
        acc["sample_count"] += len(session_rows)
        for row in session_rows:
            if row.meter_current_a is not None:
                current = abs(Decimal(row.meter_current_a))
                if acc["max_meter_current_a"] is None or current > acc["max_meter_current_a"]:
                    acc["max_meter_current_a"] = current
            if row.battery_soc_percent is not None:
                acc["soc_total"] += Decimal(row.battery_soc_percent)
                acc["soc_count"] += 1

    for acc in vehicle_day_accumulator.values():
        session_count = acc["total_sessions"] or 1
        db.add(
            VehicleDailyAggregate(
                tenant_key=tenant_key,
                event_date=acc["event_date"],
                source=acc["source"],
                host_name=acc["host_name"],
                vehicle_id=acc["vehicle_id"],
                vehicle_name=acc["vehicle_name"],
                vehicle_type=acc["vehicle_type"],
                total_sessions=acc["total_sessions"],
                total_energy_kwh=acc["total_energy_kwh"],
                average_duration_minutes=acc["duration_minutes"] / Decimal(session_count),
                max_meter_current_a=acc["max_meter_current_a"],
                average_battery_soc_percent=(
                    acc["soc_total"] / Decimal(acc["soc_count"])
                    if acc["soc_count"]
                    else None
                ),
                sample_count=acc["sample_count"],
            )
        )

    return len(vehicle_day_accumulator)


def _build_prometheus_charger_daily_aggregates(db, instance: str | None = None, tenant_key: str | None = None) -> int:
    tenant_key = tenant_key or get_settings().data_tenant_key
    selected_by_instance_date: dict[tuple[str, date], dict] = {}
    for metric_name in ENERGY_COUNTER_METRICS_BY_PRIORITY:
        metric_rows = _prometheus_daily_energy_rows_for_metric(db, metric_name, instance=instance, tenant_key=tenant_key)
        for key, row in metric_rows.items():
            selected_by_instance_date.setdefault(key, row)

    for (row_instance, event_date), row in selected_by_instance_date.items():
        db.add(
            ChargerDailyAggregate(
                tenant_key=tenant_key,
                event_date=event_date,
                source="prometheus",
                host_name=row_instance,
                charger_id=row_instance,
                charger_name=row_instance,
                total_sessions=0,
                total_energy_kwh=row["total_joules"] / Decimal("3600000"),
                average_duration_minutes=0,
                sample_count=row["sample_count"],
            )
        )
    return len(selected_by_instance_date)


def _prometheus_daily_energy_rows_for_metric(
    db,
    metric_name: str,
    instance: str | None = None,
    tenant_key: str | None = None,
) -> dict[tuple[str, date], dict]:
    tenant_key = tenant_key or get_settings().data_tenant_key
    stmt = (
        select(
            PrometheusMetricSnapshot.instance,
            PrometheusMetricSnapshot.sampled_at,
            PrometheusMetricSnapshot.value,
        )
        .where(
            PrometheusMetricSnapshot.tenant_key == tenant_key,
            PrometheusMetricSnapshot.metric_name == metric_name,
        )
        .order_by(PrometheusMetricSnapshot.instance, PrometheusMetricSnapshot.sampled_at)
    )
    if instance is not None:
        stmt = stmt.where(PrometheusMetricSnapshot.instance == instance)

    totals_by_instance_date: defaultdict[tuple[str, date], Decimal] = defaultdict(Decimal)
    samples_by_instance_date: Counter[tuple[str, date]] = Counter()
    previous_by_instance: dict[str, Decimal] = {}

    for row_instance, sampled_at, value in db.execute(stmt).all():
        current_value = Decimal(value)
        event_date = sampled_at.date()
        samples_by_instance_date[(row_instance, event_date)] += 1
        previous_value = previous_by_instance.get(row_instance)
        if previous_value is not None:
            delta_joules = current_value - previous_value
            if delta_joules >= 0:
                totals_by_instance_date[(row_instance, event_date)] += delta_joules
            elif current_value > 0:
                totals_by_instance_date[(row_instance, event_date)] += current_value
        previous_by_instance[row_instance] = current_value

    rows: dict[tuple[str, date], dict] = {}
    for key, sample_count in samples_by_instance_date.items():
        rows[key] = {
            "metric_name": metric_name,
            "total_joules": totals_by_instance_date[key],
            "sample_count": sample_count,
        }
    return rows


def _build_daily_aggregates(db, tenant_key: str) -> int:
    daily: dict[date, dict] = {}

    for row in db.scalars(select(VehicleDailyAggregate).where(VehicleDailyAggregate.tenant_key == tenant_key)).all():
        acc = daily.setdefault(row.event_date, _daily_accumulator())
        acc["sessions"] += row.total_sessions
        acc["loki_energy_kwh"] += Decimal(row.total_energy_kwh)
        acc["duration_minutes"] += Decimal(row.average_duration_minutes) * row.total_sessions
        acc["duration_sessions"] += row.total_sessions
        acc["vehicles"].add(row.vehicle_id)
        acc["sources"][row.source] += Decimal(row.total_energy_kwh)

    for row in db.scalars(select(ChargerDailyAggregate).where(ChargerDailyAggregate.tenant_key == tenant_key)).all():
        acc = daily.setdefault(row.event_date, _daily_accumulator())
        acc["prometheus_energy_kwh"] += Decimal(row.total_energy_kwh)
        acc["chargers"].add(row.charger_id)
        acc["sources"][row.source] += Decimal(row.total_energy_kwh)

    for event_date, acc in daily.items():
        duration_sessions = acc["duration_sessions"] or 1
        total_energy_kwh = max(acc["loki_energy_kwh"], acc["prometheus_energy_kwh"])
        db.add(
            DailyEnergyAggregate(
                tenant_key=tenant_key,
                event_date=event_date,
                total_sessions=acc["sessions"],
                total_energy_kwh=total_energy_kwh,
                average_duration_minutes=acc["duration_minutes"] / Decimal(duration_sessions),
                active_vehicles=len(acc["vehicles"]),
                active_chargers=len(acc["chargers"]),
                source_breakdown={key: str(value) for key, value in acc["sources"].items()},
            )
        )

    return len(daily)


def _daily_accumulator() -> dict:
    return {
        "sessions": 0,
        "loki_energy_kwh": Decimal("0"),
        "prometheus_energy_kwh": Decimal("0"),
        "duration_minutes": Decimal("0"),
        "duration_sessions": 0,
        "vehicles": set(),
        "chargers": set(),
        "sources": defaultdict(Decimal),
    }


def _select_energy_counter_metric(db, instance: str | None = None, tenant_key: str | None = None) -> str | None:
    tenant_key = tenant_key or get_settings().data_tenant_key
    for metric_name in ENERGY_COUNTER_METRICS_BY_PRIORITY:
        stmt = select(func.count(PrometheusMetricSnapshot.id)).where(
            PrometheusMetricSnapshot.tenant_key == tenant_key,
            PrometheusMetricSnapshot.metric_name == metric_name
        )
        if instance is not None:
            stmt = stmt.where(PrometheusMetricSnapshot.instance == instance)
        if db.scalar(stmt):
            return metric_name
    return None


def _duration_minutes(started_at: datetime, ended_at: datetime) -> Decimal:
    seconds = max((ended_at - started_at).total_seconds(), 0)
    return Decimal(str(seconds)) / Decimal("60")


def _latest_non_empty(values) -> str | None:
    for value in reversed(list(values)):
        if value:
            return value
    return None


def _loki_session_key(row: LokiVehicleSnapshot) -> str | None:
    session_id = (
        _payload_transfer_session_correlation_id(row.payload)
        or row.session_id
    )
    if not session_id:
        return None

    started_at = row.session_started_at or _payload_transfer_session_start(row.payload)
    if not started_at:
        return session_id

    return f"{session_id}::{started_at.isoformat()}"


def _payload_transfer_session_correlation_id(payload: dict | None) -> str | None:
    if not isinstance(payload, dict):
        return None
    value = (
        payload.get("EnergyLink", {})
        .get("TransferSession", {})
        .get("RemoteDevice", {})
        .get("CorrelationId")
    )
    return str(value) if value else None


def _payload_transfer_session_start(payload: dict | None) -> datetime | None:
    if not isinstance(payload, dict):
        return None
    value = (
        payload.get("EnergyLink", {})
        .get("TransferSession", {})
        .get("Start")
    )
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _payload_transfer_session_end(payload: dict | None) -> datetime | None:
    if not isinstance(payload, dict):
        return None
    value = (
        payload.get("EnergyLink", {})
        .get("TransferSession", {})
        .get("End")
    )
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _session_soc_range(rows: list[LokiVehicleSnapshot]) -> tuple[Decimal | None, Decimal | None]:
    range_min_values: list[Decimal] = []
    range_max_values: list[Decimal] = []
    for row in rows:
        transfer_session = (
            row.payload.get("EnergyLink", {}).get("TransferSession", {})
            if isinstance(row.payload, dict)
            else {}
        )
        local_range = transfer_session.get("LocalSoCRange", {}) if isinstance(transfer_session, dict) else {}
        start_soc = _decimal_from_nested(local_range, "Min", "Percent")
        end_soc = _decimal_from_nested(local_range, "Max", "Percent")
        if start_soc is not None:
            range_min_values.append(start_soc)
        if end_soc is not None:
            range_max_values.append(end_soc)

    if range_min_values or range_max_values:
        return (
            min(range_min_values) if range_min_values else None,
            max(range_max_values) if range_max_values else None,
        )

    soc_values = [Decimal(row.battery_soc_percent) for row in rows if row.battery_soc_percent is not None]
    if not soc_values:
        return None, None
    return min(soc_values), max(soc_values)


def _session_remote_device_id(rows: list[LokiVehicleSnapshot]) -> str | None:
    for row in rows:
        if isinstance(row.labels, dict):
            label_value = row.labels.get("remote_device_id")
            if label_value:
                return str(label_value)
        transfer_session = (
            row.payload.get("EnergyLink", {}).get("TransferSession", {})
            if isinstance(row.payload, dict)
            else {}
        )
        remote_device = transfer_session.get("RemoteDevice", {}) if isinstance(transfer_session, dict) else {}
        remote_name = remote_device.get("Name") if isinstance(remote_device, dict) else None
        remote_id = _remote_device_id(str(remote_name)) if remote_name else None
        if remote_id:
            return remote_id
    return None


def _remote_device_id(remote_device_name: str) -> str | None:
    parts = remote_device_name.split("/")
    if len(parts) >= 3 and parts[2]:
        return parts[2]
    return remote_device_name or None


def _decimal_from_nested(payload: dict | None, *path: str) -> Decimal | None:
    current = payload
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    if current is None:
        return None
    try:
        value = Decimal(str(current))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return value if value.is_finite() else None


def _transfer_session_energy_wh_values(payload: dict | None) -> list[Decimal]:
    if not isinstance(payload, dict):
        return []

    transfer_session = (
        payload.get("EnergyLink", {})
        .get("TransferSession", {})
    )

    values: list[Decimal] = []
    for energy_key in ("SuppliedEnergy", "ReceivedEnergy"):
        energy_mix = transfer_session.get(energy_key, {})
        mix = energy_mix.get("Mix", [])
        if not isinstance(mix, list):
            continue
        for item in mix:
            if not isinstance(item, dict):
                continue
            watt_hours = item.get("Energy", {}).get("WattHours")
            if watt_hours is None:
                continue
            try:
                value = Decimal(str(watt_hours))
            except (InvalidOperation, TypeError, ValueError):
                continue
            if value.is_finite():
                values.append(value)
    return values
