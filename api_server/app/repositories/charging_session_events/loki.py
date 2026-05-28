from __future__ import annotations

from datetime import datetime
from typing import Any, TYPE_CHECKING

from app.services.loki_client import LokiClient

if TYPE_CHECKING:
    from app.config import Settings


class LokiChargingSessionEventRepository:
    source_name = "loki"

    def __init__(self, settings: Settings):
        self.client = LokiClient(settings)

    async def query_vehicle_snapshots(
        self,
        host_name: str | None,
        start: datetime,
        end: datetime,
    ) -> list[dict[str, Any]]:
        return await self.client.query_vehicle_snapshots(host_name=host_name, start=start, end=end)
