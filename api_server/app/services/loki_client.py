from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
import re
from typing import Any

import httpx

from app.config import Settings


class LokiClientError(RuntimeError):
    pass


class LokiClient:
    def __init__(self, settings: Settings):
        if not settings.loki_base_url:
            raise LokiClientError("LOKI_BASE_URL is not configured.")
        self.base_url = settings.loki_base_url.rstrip("/")
        self.auth = settings.loki_auth

    async def query_vehicle_snapshots(
        self,
        host_name: str | None,
        start: datetime,
        end: datetime,
        limit: int = 5000,
    ) -> list[dict[str, Any]]:
        selector = _vehicle_snapshot_selector(host_name)
        snapshots: list[dict[str, Any]] = []
        current_start_ns = int(start.timestamp() * 1_000_000_000)
        end_ns = int(end.timestamp() * 1_000_000_000)

        while current_start_ns <= end_ns:
            data = await self._get(
                self._query_range_path,
                params={
                    "query": selector,
                    "start": str(current_start_ns),
                    "end": str(end_ns),
                    "limit": str(limit),
                    "direction": "FORWARD",
                },
            )

            page_values = 0
            last_ts_ns = current_start_ns
            for stream in data.get("data", {}).get("result", []):
                labels = dict(stream.get("stream", {}))
                for ts, line in stream.get("values", []):
                    page_values += 1
                    last_ts_ns = max(last_ts_ns, int(ts))
                    parsed = self._parse_log_line(ts, line, labels, host_name)
                    if parsed is not None:
                        snapshots.append(parsed)

            if page_values < limit or last_ts_ns < current_start_ns:
                break
            current_start_ns = last_ts_ns + 1

        return snapshots

    @property
    def _query_range_path(self) -> str:
        if self.base_url.endswith("/loki"):
            return "/api/v1/query_range"
        return "/loki/api/v1/query_range"

    async def _get(self, path: str, params: dict[str, str]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(auth=self.auth, timeout=60.0) as client:
                response = await client.get(f"{self.base_url}{path}", params=params)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise LokiClientError(f"Loki request failed: {exc}") from exc

        payload = response.json()
        if payload.get("status") != "success":
            raise LokiClientError(f"Loki returned non-success status: {payload}")
        return payload

    def _parse_log_line(
        self,
        ts: str,
        line: str,
        labels: dict[str, Any],
        fallback_host_name: str,
    ) -> dict[str, Any] | None:
        payload_match = re.search(r"Payload\s*=\s*(\{.*\})\s*$", line)
        if payload_match is None:
            return None

        try:
            payload = json.loads(payload_match.group(1))
        except json.JSONDecodeError:
            return None

        topic_match = re.search(r"Topic\s*=\s*(.*?)\s+Payload\s*=", line)
        topic = topic_match.group(1).strip() if topic_match else None
        topic_parts = topic.split("/") if topic else []
        topic_device_id = topic_parts[2] if len(topic_parts) > 2 else None

        sampled_at = datetime.fromtimestamp(int(ts) / 1_000_000_000, tz=timezone.utc)
        session_id = _as_string(
            _get_nested(payload, "EnergyLink", "TransferSession", "RemoteDevice", "CorrelationId")
        ) or _as_string(_get_nested(payload, "Session", "Id"))
        session_started_at = (
            _parse_datetime(_get_nested(payload, "EnergyLink", "TransferSession", "Start"))
            or _parse_datetime(_get_nested(payload, "Session", "Start"))
        )

        return {
            "line_hash": sha256(f"{ts}:{line}".encode("utf-8")).hexdigest(),
            "host_name": str(labels.get("host_name") or fallback_host_name),
            "unit": str(labels.get("unit") or "datacoremachine.service"),
            "sampled_at": sampled_at,
            "topic": topic,
            "topic_device_id": topic_device_id,
            "session_id": session_id,
            "session_started_at": session_started_at,
            "vehicle_name": _as_string(_get_nested(payload, "CustomData", "VehicleName")),
            "vehicle_type": _as_string(_get_nested(payload, "CustomData", "VehicleType")),
            "energy_link_state": _as_string(_get_nested(payload, "EnergyLink", "State")),
            "device_state": _as_string(_get_nested(payload, "State", "State")),
            "meter_total_input_wh": _decimal_or_none(_get_nested(payload, "Meter", "TotalInput", "WattHours")),
            "meter_total_output_wh": _decimal_or_none(_get_nested(payload, "Meter", "TotalOutput", "WattHours")),
            "meter_voltage_v": _decimal_or_none(_get_nested(payload, "Meter", "Voltage", "Volts")),
            "meter_current_a": _decimal_or_none(_get_nested(payload, "Meter", "Current", "Amps")),
            "battery_soc_percent": _decimal_or_none(_get_nested(payload, "BatteryInfo", "StateOfCharge", "Percent")),
            "labels": labels,
            "payload": payload,
        }


def _get_nested(payload: dict[str, Any], *path: str) -> Any:
    current: Any = payload
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def _vehicle_snapshot_selector(host_name: str | None) -> str:
    if host_name:
        escaped_host = host_name.replace("\\", "\\\\").replace('"', '\\"')
        return f'{{host_name="{escaped_host}", unit="datacoremachine.service"}} |= "Payload" |= "Session"'
    return '{unit="datacoremachine.service"} |= "Payload" |= "Session"'


def _as_string(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _decimal_or_none(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if not parsed.is_finite():
        return None
    return parsed


def _parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed
