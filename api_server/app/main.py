import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import aggregates, dashboard, health, loki, prometheus
from app.services.loki_sync import run_loki_sync_loop
from app.services.prometheus_sync import run_prometheus_sync_loop


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    sync_tasks: list[asyncio.Task[None]] = []
    if settings.prometheus_sync_enabled and settings.prometheus_configured:
        sync_tasks.append(asyncio.create_task(run_prometheus_sync_loop()))
    if settings.charging_session_sync_enabled and settings.charging_session_source_configured:
        sync_tasks.append(asyncio.create_task(run_loki_sync_loop()))

    try:
        yield
    finally:
        for sync_task in sync_tasks:
            sync_task.cancel()
        for sync_task in sync_tasks:
            try:
                await sync_task
            except asyncio.CancelledError:
                pass


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(prometheus.router, prefix="/api", tags=["prometheus"])
app.include_router(loki.router, prefix="/api", tags=["loki"])
app.include_router(aggregates.router, prefix="/api", tags=["aggregates"])


@app.get("/")
def root() -> dict[str, str]:
    return {"service": settings.app_name, "docs": "/docs"}
