import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.config import get_settings
from app.db import SessionLocal
from app.models import BackgroundSyncRun, LokiVehicleSnapshot
from app.repositories.charging_session_events import get_charging_session_event_repository
from app.services.aggregate_rebuild import rebuild_ui_aggregates_in_session

logger = logging.getLogger("uvicorn.error")


async def run_loki_sync_loop() -> None:
    settings = get_settings()
    logger.info(
        "Starting charging session event sync loop: source=%s interval=%ss host_name=%s lookback_minutes=%s",
        settings.charging_session_source,
        settings.loki_sync_interval_seconds,
        "all",
        settings.loki_sync_lookback_minutes,
    )
    try:
        await sync_loki_since_last_sample()
    except Exception:
        logger.exception("Loki startup catch-up failed")

    while True:
        try:
            await sync_loki_once()
        except Exception:
            logger.exception("Loki sync iteration failed")
        await asyncio.sleep(settings.loki_sync_interval_seconds)


async def sync_loki_once(host_name: str | None = None, lookback_minutes: int | None = None) -> int:
    settings = get_settings()
    selected_host = host_name
    selected_lookback = lookback_minutes or settings.loki_sync_lookback_minutes
    finished_at = datetime.now(timezone.utc)
    started_window_at = finished_at - timedelta(minutes=selected_lookback)
    result = await sync_loki_range(
        start=started_window_at,
        end=finished_at,
        host_name=selected_host,
        source="loki",
        message=f"lookback_minutes={selected_lookback} host_name={selected_host or 'all'}",
    )
    return int(result["rows_written"])


async def sync_loki_since_last_sample(host_name: str | None = None) -> dict[str, int | str]:
    with SessionLocal() as db:
        stmt = select(func.max(LokiVehicleSnapshot.sampled_at))
        if host_name:
            stmt = stmt.where(LokiVehicleSnapshot.host_name == host_name)
        last_sampled_at = db.scalar(stmt)

    if last_sampled_at is None:
        logger.info("Loki startup catch-up skipped: no existing snapshots")
        return {"status": "skipped", "reason": "no_existing_snapshots"}

    start = _as_utc(last_sampled_at)
    end = datetime.now(timezone.utc)
    if start >= end:
        logger.info("Loki startup catch-up skipped: last_sampled_at=%s is current", start.isoformat())
        return {"status": "skipped", "reason": "already_current", "start": start.isoformat(), "end": end.isoformat()}

    return await sync_loki_range(
        start=start,
        end=end,
        host_name=host_name,
        source="loki_startup_catchup",
        message=f"startup catch-up start={start.isoformat()} end={end.isoformat()} host_name={host_name or 'all'}",
    )


async def sync_loki_range(
    start: datetime,
    end: datetime,
    host_name: str | None = None,
    source: str = "loki",
    message: str | None = None,
) -> dict[str, int | str]:
    settings = get_settings()
    repository = get_charging_session_event_repository(settings)
    selected_host = host_name
    start = _as_utc(start)
    end = _as_utc(end)
    started_at = datetime.now(timezone.utc)
    logger.info(
        "Charging session event range sync started: configured_source=%s source=%s host_name=%s start=%s end=%s",
        repository.source_name,
        source,
        selected_host or "all",
        start.isoformat(),
        end.isoformat(),
    )

    with SessionLocal() as db:
        sync_run = BackgroundSyncRun(
            source=f"{repository.source_name}_{source}" if repository.source_name != "loki" else source,
            status="running",
            started_at=started_at,
            message=message or f"start={start.isoformat()} end={end.isoformat()} host_name={selected_host or 'all'}",
        )
        db.add(sync_run)
        db.commit()
        db.refresh(sync_run)

        rows_written = 0
        try:
            snapshots = await repository.query_vehicle_snapshots(
                host_name=selected_host,
                start=start,
                end=end,
            )
            hashes = [snapshot["line_hash"] for snapshot in snapshots]
            existing_hashes = set()
            if hashes:
                existing_hashes = set(
                    db.scalars(
                        select(LokiVehicleSnapshot.line_hash).where(
                            LokiVehicleSnapshot.line_hash.in_(hashes)
                        )
                    ).all()
                )

            for snapshot in snapshots:
                if snapshot["line_hash"] in existing_hashes:
                    continue
                db.add(LokiVehicleSnapshot(**snapshot))
                rows_written += 1

            db.flush()
            aggregate_counts = rebuild_ui_aggregates_in_session(db)
            sync_run.status = "success"
            sync_run.finished_at = datetime.now(timezone.utc)
            sync_run.rows_written = rows_written
            sync_run.message = (
                f"fetched={len(snapshots)} written={rows_written} "
                f"aggregate_counts={aggregate_counts.as_dict()} start={start.isoformat()} end={end.isoformat()}"
            )
            db.commit()
            logger.info(
                "Charging session event range sync finished successfully: configured_source=%s source=%s fetched=%s rows_written=%s aggregate_counts=%s",
                repository.source_name,
                source,
                len(snapshots),
                rows_written,
                aggregate_counts.as_dict(),
            )
            return {
                "status": "ok",
                "rows_fetched": len(snapshots),
                "rows_written": rows_written,
                "start": start.isoformat(),
                "end": end.isoformat(),
            }
        except Exception as exc:
            sync_run.status = "failed"
            sync_run.finished_at = datetime.now(timezone.utc)
            sync_run.message = str(exc)
            sync_run.rows_written = rows_written
            db.commit()
            logger.exception(
                "Charging session event range sync failed: configured_source=%s source=%s rows_written=%s",
                repository.source_name,
                source,
                rows_written,
            )
            raise


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
