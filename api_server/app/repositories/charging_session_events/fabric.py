from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
from typing import Any, TYPE_CHECKING

from app.repositories.charging_session_events.exceptions import ChargingSessionEventRepositoryError

if TYPE_CHECKING:
    from app.config import Settings


class FabricKqlChargingSessionEventRepository:
    source_name = "fabric"

    def __init__(self, settings: Settings):
        if not settings.fabric_configured:
            raise ChargingSessionEventRepositoryError(
                "Fabric KQL is not configured. Set FABRIC_KQL_QUERY_URI, "
                "FABRIC_KQL_DATABASE, and FABRIC_KQL_TABLE."
            )
        self.settings = settings

    async def query_vehicle_snapshots(
        self,
        host_name: str | None,
        start: datetime,
        end: datetime,
    ) -> list[dict[str, Any]]:
        try:
            from azure.kusto.data import KustoClient, KustoConnectionStringBuilder
        except ImportError as exc:
            raise ChargingSessionEventRepositoryError(
                "Fabric source requires azure-kusto-data and azure-identity packages."
            ) from exc

        query_uri = self.settings.fabric_kql_query_uri
        database = self.settings.fabric_kql_database
        table = self.settings.fabric_kql_table
        name_column = _safe_identifier(self.settings.fabric_kql_name_column)
        payload_column = _safe_identifier(self.settings.fabric_kql_payload_column)

        if not query_uri:
            raise ChargingSessionEventRepositoryError("Fabric query URI is not configured.")

        if self.settings.azure_tenant_id and self.settings.azure_client_id and self.settings.azure_client_secret:
            kcsb = KustoConnectionStringBuilder.with_aad_application_key_authentication(
                query_uri,
                self.settings.azure_client_id,
                self.settings.azure_client_secret,
                self.settings.azure_tenant_id,
            )
        else:
            kcsb = KustoConnectionStringBuilder.with_az_cli_authentication(query_uri)

        start = _as_utc(start)
        end = _as_utc(end)
        query = f"""
let start_time = datetime({_kql_datetime(start)});
let end_time = datetime({_kql_datetime(end)});
table("{_escape_kql_string(table)}")
| where ingestion_time() between (start_time .. end_time)
| project
    EventName = tostring(column_ifexists("{name_column}", "")),
    RawPayload = tostring(column_ifexists("{payload_column}", "")),
    IngestedAt = ingestion_time()
| where EventName == "PhysicalDeviceEvent_Changed"
| where RawPayload has "TransferSession"
| order by IngestedAt asc
"""

        client = KustoClient(kcsb)
        try:
            response = client.execute(database, query)
        except Exception as exc:
            raise ChargingSessionEventRepositoryError(f"Fabric KQL query failed: {exc}") from exc
        finally:
            close = getattr(client, "close", None)
            if close is not None:
                close()

        snapshots: list[dict[str, Any]] = []
        for row in response.primary_results[0]:
            event_name = str(row["EventName"] or "")
            raw_payload = row["RawPayload"]
            sampled_at = _as_utc(row["IngestedAt"])
            parsed = _parse_fabric_payload(
                raw_payload=raw_payload,
                event_name=event_name,
                sampled_at=sampled_at,
                fallback_host_name=host_name,
            )
            if parsed is not None:
                snapshots.append(parsed)
        return snapshots


def _parse_fabric_payload(
    raw_payload: Any,
    event_name: str,
    sampled_at: datetime,
    fallback_host_name: str | None,
) -> dict[str, Any] | None:
    payload = _coerce_payload(raw_payload)
    if payload is None:
        return None

    payload = _unwrap_payload(payload)
    if not isinstance(payload, dict):
        return None

    if event_name != "PhysicalDeviceEvent_Changed":
        return None

    device_payload = payload.get("Device")
    if not isinstance(device_payload, dict):
        device_payload = payload

    energy_link = device_payload.get("EnergyLink")
    if not isinstance(energy_link, dict):
        return None

    transfer_session = energy_link.get("TransferSession")
    if not isinstance(transfer_session, dict):
        return None

    session = device_payload.get("Session") if isinstance(device_payload.get("Session"), dict) else {}
    identity = payload.get("Id") if isinstance(payload.get("Id"), dict) else {}
    device_id = _as_string(identity.get("Id")) if identity else None
    device_type = _as_string(identity.get("Type")) if identity else None
    device_version = _as_string(identity.get("Version")) if identity else None
    device_name = _as_string(payload.get("Name"))
    sampled_at = _parse_datetime(payload.get("Timestamp")) or sampled_at

    session_id = _as_string(
        _get_nested(transfer_session, "RemoteDevice", "CorrelationId")
    ) or (session and _as_string(session.get("Id"))) or None
    session_started_at = (
        _parse_datetime(transfer_session.get("Start"))
        or (session and _parse_datetime(session.get("Start")))
        or None
    )
    host_name = (
        _as_string(payload.get("host_name"))
        or _as_string(payload.get("HostName"))
        or _as_string(payload.get("Instance"))
        or device_id
        or device_name
        or fallback_host_name
        or "fabric"
    )
    topic = (
        _as_string(payload.get("Topic"))
        or (
            f"fabric/{device_type}/{device_version}/{device_id}"
            if device_type and device_version and device_id
            else event_name
        )
    )
    topic_device_id = device_id or _as_string(payload.get("DeviceId"))

    normalized_payload = dict(device_payload)
    normalized_payload["FabricEvent"] = {
        "Name": event_name,
        "DeviceId": identity,
        "DeviceName": device_name,
        "Timestamp": payload.get("Timestamp"),
    }

    vehicle_name = (
        device_name
        if device_type == "vehicle"
        else _as_string(_get_nested(device_payload, "CustomData", "VehicleName"))
    )
    vehicle_type = (
        device_type
        if device_type == "vehicle"
        else _as_string(_get_nested(device_payload, "CustomData", "VehicleType"))
    )

    hash_material = json.dumps(normalized_payload, sort_keys=True, default=str)
    return {
        "line_hash": sha256(f"fabric:{sampled_at.isoformat()}:{event_name}:{hash_material}".encode("utf-8")).hexdigest(),
        "host_name": host_name,
        "unit": "fabric.eventstream",
        "sampled_at": sampled_at,
        "topic": topic,
        "topic_device_id": topic_device_id,
        "session_id": session_id,
        "session_started_at": session_started_at,
        "vehicle_name": vehicle_name,
        "vehicle_type": vehicle_type,
        "energy_link_state": _as_string(energy_link.get("State")),
        "device_state": _as_string(_get_nested(device_payload, "State", "State")),
        "meter_total_input_wh": _decimal_or_none(_get_nested(device_payload, "Meter", "TotalInput", "WattHours")),
        "meter_total_output_wh": _decimal_or_none(_get_nested(device_payload, "Meter", "TotalOutput", "WattHours")),
        "meter_voltage_v": _decimal_or_none(_get_nested(device_payload, "Meter", "Voltage", "Volts")),
        "meter_current_a": _decimal_or_none(_get_nested(device_payload, "Meter", "Current", "Amps")),
        "battery_soc_percent": _decimal_or_none(_get_nested(device_payload, "BatteryInfo", "StateOfCharge", "Percent")),
        "labels": {
            "source": "fabric",
            "event_name": event_name,
            "device_type": device_type,
            "device_id": device_id,
            "device_name": device_name,
        },
        "payload": normalized_payload,
    }


def _coerce_payload(raw_payload: Any) -> Any:
    if isinstance(raw_payload, dict):
        return raw_payload
    if raw_payload is None:
        return None
    if not isinstance(raw_payload, str):
        raw_payload = str(raw_payload)
    if not raw_payload:
        return None
    try:
        return json.loads(raw_payload)
    except json.JSONDecodeError:
        return None


def _unwrap_payload(payload: Any) -> Any:
    current = payload
    for _ in range(3):
        if isinstance(current, dict) and "Payload" in current and "EnergyLink" not in current:
            current = _coerce_payload(current["Payload"])
            continue
        if isinstance(current, str):
            current = _coerce_payload(current)
            continue
        break
    return current


def _get_nested(payload: dict[str, Any], *path: str) -> Any:
    current: Any = payload
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


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
    return _as_utc(parsed)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _safe_identifier(value: str) -> str:
    if not value.replace("_", "").isalnum():
        raise ChargingSessionEventRepositoryError(f"Unsafe Fabric KQL identifier: {value}")
    return value


def _escape_kql_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _kql_datetime(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
