import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from app.config import get_settings
from app.db import SessionLocal
from app.models import BackgroundSyncRun, PrometheusInstance, PrometheusMetricSnapshot
from app.prometheus_metrics import PROMETHEUS_SYNC_METRICS
from app.services.aggregate_rebuild import rebuild_prometheus_daily_energy_aggregates_in_session
from app.services.prometheus_client import PrometheusClient

logger = logging.getLogger("uvicorn.error")


async def run_prometheus_sync_loop() -> None:
    settings = get_settings()
    logger.info(
        "Starting Prometheus sync loop: interval=%ss default_instance=%s",
        settings.prometheus_sync_interval_seconds,
        settings.prometheus_default_instance,
    )
    try:
        await sync_prometheus_since_last_sample()
    except Exception:
        logger.exception("Prometheus startup catch-up failed")

    while True:
        try:
            await sync_prometheus_once()
        except Exception:
            # Failure details are already recorded in background_sync_runs.
            logger.exception("Prometheus sync iteration failed")
        await asyncio.sleep(settings.prometheus_sync_interval_seconds)


async def sync_prometheus_once() -> int:
    settings = get_settings()
    tenant_key = settings.data_tenant_key
    client = PrometheusClient(settings)
    started_at = datetime.now(timezone.utc)
    logger.info("Prometheus sync started")

    with SessionLocal() as db:
        sync_run = BackgroundSyncRun(tenant_key=tenant_key, source="prometheus", status="running", started_at=started_at)
        db.add(sync_run)
        db.commit()
        db.refresh(sync_run)

        rows_written = 0
        try:
            instances = await client.label_values("instance")
            selected_instances = instances or [settings.prometheus_default_instance]
            logger.info("Prometheus sync discovered %s instance(s)", len(selected_instances))

            for instance in selected_instances:
                db.merge(
                    PrometheusInstance(
                        tenant_key=tenant_key,
                        instance=instance,
                        last_seen_at=datetime.now(timezone.utc),
                        labels={},
                    )
                )

                metrics = await client.current_metrics(instance, PROMETHEUS_SYNC_METRICS)
                logger.info(
                    "Prometheus sync fetched %s metric sample(s) for instance=%s",
                    len(metrics),
                    instance,
                )
                for metric in metrics:
                    metric["tenant_key"] = tenant_key
                    db.add(PrometheusMetricSnapshot(**metric))
                    rows_written += 1

            db.flush()
            daily_rows = rebuild_prometheus_daily_energy_aggregates_in_session(db, tenant_key=tenant_key)

            sync_run.status = "success"
            sync_run.finished_at = datetime.now(timezone.utc)
            sync_run.rows_written = rows_written
            db.commit()
            logger.info(
                "Prometheus sync finished successfully: rows_written=%s daily_aggregate_rows=%s",
                rows_written,
                daily_rows,
            )
            return rows_written
        except Exception as exc:
            sync_run.status = "failed"
            sync_run.finished_at = datetime.now(timezone.utc)
            sync_run.message = str(exc)
            sync_run.rows_written = rows_written
            db.commit()
            logger.exception("Prometheus sync failed: rows_written=%s", rows_written)
            raise


async def backfill_prometheus_history(
    days: int = 7,
    step_seconds: int = 60,
    instance: str | None = None,
) -> dict[str, int | str]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    return await backfill_prometheus_range(
        start=start,
        end=end,
        step_seconds=step_seconds,
        instance=instance,
        source="prometheus_backfill",
        message=f"days={days} step_seconds={step_seconds} instance={instance or '*'}",
    )


async def sync_prometheus_since_last_sample(step_seconds: int = 60) -> dict[str, int | str]:
    tenant_key = get_settings().data_tenant_key
    with SessionLocal() as db:
        last_sampled_at = db.scalar(
            select(func.max(PrometheusMetricSnapshot.sampled_at)).where(
                PrometheusMetricSnapshot.tenant_key == tenant_key,
            )
        )

    if last_sampled_at is None:
        logger.info("Prometheus startup catch-up skipped: no existing samples")
        return {"status": "skipped", "reason": "no_existing_samples"}

    start = _as_utc(last_sampled_at)
    end = datetime.now(timezone.utc)
    if start >= end:
        logger.info("Prometheus startup catch-up skipped: last_sampled_at=%s is current", start.isoformat())
        return {"status": "skipped", "reason": "already_current", "start": start.isoformat(), "end": end.isoformat()}

    return await backfill_prometheus_range(
        start=start,
        end=end,
        step_seconds=step_seconds,
        instance=None,
        source="prometheus_startup_catchup",
        message=f"startup catch-up start={start.isoformat()} end={end.isoformat()} step_seconds={step_seconds}",
    )


async def backfill_prometheus_range(
    start: datetime,
    end: datetime,
    step_seconds: int = 60,
    instance: str | None = None,
    source: str = "prometheus_backfill",
    message: str | None = None,
) -> dict[str, int | str]:
    settings = get_settings()
    tenant_key = settings.data_tenant_key
    client = PrometheusClient(settings)
    start = _as_utc(start)
    end = _as_utc(end)
    started_at = datetime.now(timezone.utc)
    logger.info(
        "Prometheus range sync started: source=%s step_seconds=%s instance=%s start=%s end=%s",
        source,
        step_seconds,
        instance or "*",
        start.isoformat(),
        end.isoformat(),
    )

    with SessionLocal() as db:
        sync_run = BackgroundSyncRun(
            tenant_key=tenant_key,
            source=source,
            status="running",
            started_at=started_at,
            message=message or f"start={start.isoformat()} end={end.isoformat()} step_seconds={step_seconds} instance={instance or '*'}",
        )
        db.add(sync_run)
        db.commit()
        db.refresh(sync_run)

        rows_fetched = 0
        rows_written = 0
        try:
            selected_instances = [instance] if instance else await client.label_values("instance")
            if not selected_instances:
                selected_instances = [settings.prometheus_default_instance]
            logger.info("Prometheus backfill selected %s instance(s)", len(selected_instances))

            for selected_instance in selected_instances:
                db.merge(
                    PrometheusInstance(
                        tenant_key=tenant_key,
                        instance=selected_instance,
                        last_seen_at=datetime.now(timezone.utc),
                        labels={},
                    )
                )

                for metric_name in PROMETHEUS_SYNC_METRICS:
                    metrics = await client.range_metrics(
                        selected_instance,
                        [metric_name],
                        start=start,
                        end=end,
                        step_seconds=step_seconds,
                    )
                    rows_fetched += len(metrics)
                    existing_keys = _existing_snapshot_keys(
                        db,
                        tenant_key=tenant_key,
                        instance=selected_instance,
                        metric_name=metric_name,
                        start=start,
                        end=end,
                    )
                    for metric in metrics:
                        key = _snapshot_key(metric["sampled_at"], metric["labels"])
                        if key in existing_keys:
                            continue
                        metric["tenant_key"] = tenant_key
                        db.add(PrometheusMetricSnapshot(**metric))
                        existing_keys.add(key)
                        rows_written += 1
                    db.flush()
                    logger.info(
                        "Prometheus backfill metric done: instance=%s metric=%s fetched=%s written_total=%s",
                        selected_instance,
                        metric_name,
                        len(metrics),
                        rows_written,
                    )

            aggregate_rows = rebuild_prometheus_daily_energy_aggregates_in_session(db, tenant_key=tenant_key)

            sync_run.status = "success"
            sync_run.finished_at = datetime.now(timezone.utc)
            sync_run.rows_written = rows_written
            sync_run.message = (
                f"fetched={rows_fetched} written={rows_written} "
                f"daily_aggregate_rows={aggregate_rows} start={start.isoformat()} "
                f"end={end.isoformat()} step_seconds={step_seconds}"
            )
            db.commit()
            logger.info(
                "Prometheus range sync finished successfully: source=%s fetched=%s rows_written=%s daily_aggregate_rows=%s",
                source,
                rows_fetched,
                rows_written,
                aggregate_rows,
            )
            return {
                "status": "ok",
                "rows_fetched": rows_fetched,
                "rows_written": rows_written,
                "daily_aggregate_rows": aggregate_rows,
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
                "Prometheus range sync failed: source=%s fetched=%s rows_written=%s",
                source,
                rows_fetched,
                rows_written,
            )
            raise


def _existing_snapshot_keys(
    db,
    tenant_key: str,
    instance: str,
    metric_name: str,
    start: datetime,
    end: datetime,
) -> set[tuple[datetime, str]]:
    stmt = select(PrometheusMetricSnapshot.sampled_at, PrometheusMetricSnapshot.labels).where(
        PrometheusMetricSnapshot.tenant_key == tenant_key,
        PrometheusMetricSnapshot.instance == instance,
        PrometheusMetricSnapshot.metric_name == metric_name,
        PrometheusMetricSnapshot.sampled_at >= start,
        PrometheusMetricSnapshot.sampled_at <= end,
    )
    return {_snapshot_key(sampled_at, labels) for sampled_at, labels in db.execute(stmt).all()}


def _snapshot_key(sampled_at: datetime, labels: dict) -> tuple[datetime, str]:
    return sampled_at, json.dumps(labels or {}, sort_keys=True, separators=(",", ":"))


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
