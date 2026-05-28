from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.config import Settings, get_settings
from app.prometheus_metrics import PROMETHEUS_SYNC_METRICS
from app.services.loki_client import LokiClient, LokiClientError
from app.services.prometheus_client import PrometheusClient, PrometheusClientError

router = APIRouter()


@router.get("/dashboard/now")
async def get_dashboard_now(
    instance: str | None = Query(default=None),
    host_name: str | None = Query(default=None),
    loki_lookback_minutes: int = Query(default=120, ge=1, le=10080),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    selected_instance = instance or settings.prometheus_default_instance
    selected_host = host_name or settings.loki_default_host_name

    prometheus = await _read_prometheus_now(settings, selected_instance)
    loki = await _read_loki_now(settings, selected_host, loki_lookback_minutes)

    return {
        "instance": selected_instance,
        "host_name": selected_host,
        "prometheus": prometheus,
        "loki": loki,
    }


async def _read_prometheus_now(settings: Settings, instance: str) -> dict[str, Any]:
    if not settings.prometheus_configured:
        return {"status": "not_configured", "metrics": {}}

    try:
        metrics = await PrometheusClient(settings).current_metrics(instance, PROMETHEUS_SYNC_METRICS)
    except PrometheusClientError as exc:
        return {"status": "error", "message": str(exc), "metrics": {}}

    metrics_by_name = {
        metric["metric_name"]: {
            "value": metric["value"],
            "sampled_at": metric["sampled_at"],
            "labels": metric["labels"],
        }
        for metric in metrics
    }
    sampled_times = [metric["sampled_at"] for metric in metrics]
    return {
        "status": "ok",
        "sampled_at": max(sampled_times) if sampled_times else None,
        "metrics": metrics_by_name,
    }


async def _read_loki_now(settings: Settings, host_name: str, lookback_minutes: int) -> dict[str, Any]:
    if not settings.loki_configured:
        return {"status": "not_configured", "snapshot": None}

    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=lookback_minutes)
    try:
        snapshots = await LokiClient(settings).query_vehicle_snapshots(
            host_name=host_name,
            start=start,
            end=end,
            limit=1000,
        )
    except LokiClientError as exc:
        return {"status": "error", "message": str(exc), "snapshot": None}

    if not snapshots:
        return {"status": "empty", "snapshot": None}

    latest = max(snapshots, key=lambda snapshot: snapshot["sampled_at"])
    return {
        "status": "ok",
        "sampled_at": latest["sampled_at"],
        "snapshot": {
            "host_name": latest["host_name"],
            "unit": latest["unit"],
            "topic": latest["topic"],
            "topic_device_id": latest["topic_device_id"],
            "session_id": latest["session_id"],
            "session_started_at": latest["session_started_at"],
            "vehicle_name": latest["vehicle_name"],
            "vehicle_type": latest["vehicle_type"],
            "energy_link_state": latest["energy_link_state"],
            "device_state": latest["device_state"],
            "meter_total_input_wh": latest["meter_total_input_wh"],
            "meter_total_output_wh": latest["meter_total_output_wh"],
            "meter_voltage_v": latest["meter_voltage_v"],
            "meter_current_a": latest["meter_current_a"],
            "battery_soc_percent": latest["battery_soc_percent"],
        },
    }
