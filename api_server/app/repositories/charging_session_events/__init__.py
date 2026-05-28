from __future__ import annotations

from app.config import Settings
from app.repositories.charging_session_events.exceptions import ChargingSessionEventRepositoryError
from app.repositories.charging_session_events.interfaces import ChargingSessionEventRepository
from app.repositories.charging_session_events.loki import LokiChargingSessionEventRepository
from app.repositories.charging_session_events.fabric import FabricKqlChargingSessionEventRepository


def get_charging_session_event_repository(settings: Settings) -> ChargingSessionEventRepository:
    if settings.charging_session_source == "fabric":
        return FabricKqlChargingSessionEventRepository(settings)
    return LokiChargingSessionEventRepository(settings)


__all__ = [
    "ChargingSessionEventRepositoryError",
    "ChargingSessionEventRepository",
    "get_charging_session_event_repository",
    "LokiChargingSessionEventRepository",
    "FabricKqlChargingSessionEventRepository",
]
