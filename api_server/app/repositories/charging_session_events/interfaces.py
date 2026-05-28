from __future__ import annotations

from datetime import datetime
from typing import Any, Protocol


class ChargingSessionEventRepository(Protocol):
    source_name: str

    async def query_vehicle_snapshots(
        self,
        host_name: str | None,
        start: datetime,
        end: datetime,
    ) -> list[dict[str, Any]]:
        ...
