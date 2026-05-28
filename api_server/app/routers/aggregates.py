from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ChargerDailyAggregate, ChargingSessionSummary, DailyEnergyAggregate, VehicleDailyAggregate
from app.schemas import (
    ChargerDailyAggregateRead,
    ChargingSessionSummaryRead,
    DailyEnergyAggregateRead,
    VehicleDailyAggregateRead,
)
from app.services.aggregate_rebuild import rebuild_prometheus_daily_energy_aggregates

router = APIRouter()


@router.post("/aggregates/rebuild/prometheus")
def rebuild_prometheus_aggregates(
    instance: str | None = Query(default=None),
) -> dict[str, int | str]:
    counts = rebuild_prometheus_daily_energy_aggregates(instance=instance)
    return {"status": "ok", "source": "all", **counts}


@router.get("/aggregates/daily", response_model=list[DailyEnergyAggregateRead])
def list_daily_aggregates(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[DailyEnergyAggregate]:
    stmt = select(DailyEnergyAggregate).order_by(DailyEnergyAggregate.event_date)
    if from_date is not None:
        stmt = stmt.where(DailyEnergyAggregate.event_date >= from_date)
    if to_date is not None:
        stmt = stmt.where(DailyEnergyAggregate.event_date <= to_date)
    return list(db.scalars(stmt).all())


@router.get("/aggregates/vehicles/daily", response_model=list[VehicleDailyAggregateRead])
def list_vehicle_daily_aggregates(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
) -> list[VehicleDailyAggregate]:
    stmt = select(VehicleDailyAggregate).order_by(
        VehicleDailyAggregate.event_date.desc(),
        VehicleDailyAggregate.total_energy_kwh.desc(),
    )
    if from_date is not None:
        stmt = stmt.where(VehicleDailyAggregate.event_date >= from_date)
    if to_date is not None:
        stmt = stmt.where(VehicleDailyAggregate.event_date <= to_date)
    return list(db.scalars(stmt.limit(limit)).all())


@router.get("/aggregates/chargers/daily", response_model=list[ChargerDailyAggregateRead])
def list_charger_daily_aggregates(
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=2000),
    db: Session = Depends(get_db),
) -> list[ChargerDailyAggregate]:
    stmt = select(ChargerDailyAggregate).order_by(
        ChargerDailyAggregate.event_date.desc(),
        ChargerDailyAggregate.total_energy_kwh.desc(),
    )
    if from_date is not None:
        stmt = stmt.where(ChargerDailyAggregate.event_date >= from_date)
    if to_date is not None:
        stmt = stmt.where(ChargerDailyAggregate.event_date <= to_date)
    return list(db.scalars(stmt.limit(limit)).all())


@router.get("/sessions/summaries", response_model=list[ChargingSessionSummaryRead])
def list_session_summaries(
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
) -> list[ChargingSessionSummary]:
    stmt = select(ChargingSessionSummary).order_by(ChargingSessionSummary.started_at.desc()).limit(limit)
    return list(db.scalars(stmt).all())
