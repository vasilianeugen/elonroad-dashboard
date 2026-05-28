from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db import get_db
from app.models import BackgroundSyncRun, PrometheusMetricSnapshot
from app.prometheus_metrics import PROMETHEUS_SYNC_METRICS
from app.schemas import BackgroundSyncRunRead, PrometheusMetricSnapshotRead
from app.services.prometheus_client import PrometheusClient, PrometheusClientError
from app.services.prometheus_sync import backfill_prometheus_history, sync_prometheus_once

router = APIRouter()


def get_prometheus_client(settings: Settings = Depends(get_settings)) -> PrometheusClient:
    if not settings.prometheus_configured:
        raise HTTPException(
            status_code=503,
            detail="Prometheus is not configured. Set PROMETHEUS_BASE_URL, PROMETHEUS_USERNAME, and PROMETHEUS_PASSWORD.",
        )
    return PrometheusClient(settings)


@router.get("/instances")
async def list_instances(client: PrometheusClient = Depends(get_prometheus_client)) -> dict[str, list[str]]:
    try:
        return {"instances": await client.label_values("instance")}
    except PrometheusClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/device/status")
async def get_device_status(
    instance: str | None = Query(default=None),
    settings: Settings = Depends(get_settings),
    client: PrometheusClient = Depends(get_prometheus_client),
) -> dict:
    selected_instance = instance or settings.prometheus_default_instance
    try:
        metrics = await client.current_metrics(selected_instance, PROMETHEUS_SYNC_METRICS)
    except PrometheusClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "instance": selected_instance,
        "metrics": metrics,
    }


@router.post("/sync/prometheus")
async def run_prometheus_sync_now() -> dict[str, int | str]:
    try:
        rows_written = await sync_prometheus_once()
    except PrometheusClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"status": "ok", "rows_written": rows_written}


@router.post("/sync/prometheus/backfill")
async def run_prometheus_backfill_now(
    days: int = Query(default=7, ge=1, le=30),
    step_seconds: int = Query(default=60, ge=30, le=3600),
    instance: str | None = Query(default=None),
) -> dict[str, int | str]:
    try:
        return await backfill_prometheus_history(
            days=days,
            step_seconds=step_seconds,
            instance=instance,
        )
    except PrometheusClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/sync/runs", response_model=list[BackgroundSyncRunRead])
def list_sync_runs(
    source: str = Query(default="prometheus"),
    tenant_key: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[BackgroundSyncRun]:
    selected_tenant = tenant_key or settings.data_tenant_key
    stmt = (
        select(BackgroundSyncRun)
        .where(
            BackgroundSyncRun.tenant_key == selected_tenant,
            BackgroundSyncRun.source == source,
        )
        .order_by(BackgroundSyncRun.started_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())


@router.get("/telemetry/snapshots/latest", response_model=list[PrometheusMetricSnapshotRead])
def get_latest_snapshots(
    instance: str | None = Query(default=None),
    tenant_key: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> list[PrometheusMetricSnapshot]:
    selected_instance = instance or settings.prometheus_default_instance
    selected_tenant = tenant_key or settings.data_tenant_key
    stmt = (
        select(PrometheusMetricSnapshot)
        .where(
            PrometheusMetricSnapshot.tenant_key == selected_tenant,
            PrometheusMetricSnapshot.instance == selected_instance,
        )
        .order_by(PrometheusMetricSnapshot.sampled_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).all())
