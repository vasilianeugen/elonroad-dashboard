from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import LokiVehicleSnapshot
from app.repositories.charging_session_events import ChargingSessionEventRepositoryError
from app.schemas import LokiVehicleSnapshotRead
from app.services.loki_client import LokiClientError
from app.services.loki_sync import sync_loki_once

router = APIRouter()


def require_session_event_source(settings: Settings = Depends(get_settings)) -> Settings:
    if not settings.charging_session_source_configured:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Charging session source '{settings.charging_session_source}' is not configured. "
                "Use Loki env vars or Fabric KQL env vars depending on CHARGING_SESSION_SOURCE."
            ),
        )
    return settings


@router.post("/sync/loki")
async def run_loki_sync_now(
    host_name: str | None = Query(default=None),
    lookback_minutes: int | None = Query(default=None, ge=1, le=10080),
    settings: Settings = Depends(require_session_event_source),
) -> dict[str, int | str]:
    try:
        rows_written = await sync_loki_once(host_name=host_name, lookback_minutes=lookback_minutes)
    except (LokiClientError, ChargingSessionEventRepositoryError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"status": "ok", "source": settings.charging_session_source, "rows_written": rows_written}


@router.get("/telemetry/loki/latest", response_model=list[LokiVehicleSnapshotRead])
def get_latest_loki_snapshots(
    host_name: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[LokiVehicleSnapshot]:
    stmt = (
        select(LokiVehicleSnapshot)
        .order_by(LokiVehicleSnapshot.sampled_at.desc())
        .limit(limit)
    )
    if host_name:
        stmt = stmt.where(LokiVehicleSnapshot.host_name == host_name)
    return list(db.scalars(stmt).all())
