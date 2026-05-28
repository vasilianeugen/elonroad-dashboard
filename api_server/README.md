# Elonroad API Server

Dockerized FastAPI service with PostgreSQL and Alembic migrations.

## Start

```powershell
Copy-Item .env.example .env
docker compose up --build
```

API:

```text
http://localhost:8000
```

OpenAPI docs:

```text
http://localhost:8000/docs
```

## Prometheus Sync

Prometheus credentials stay on the server side. To enable background sync, set this in `.env`:

```text
PROMETHEUS_PASSWORD=<secret>
PROMETHEUS_SYNC_ENABLED=true
PROMETHEUS_SYNC_INTERVAL_SECONDS=60
```

The sync stores current Prometheus samples into `prometheus_metric_snapshots` and records every run in `background_sync_runs`.

Manual sync:

```http
POST http://localhost:8000/api/sync/prometheus
```

Historical backfill from Prometheus:

```http
POST http://localhost:8000/api/sync/prometheus/backfill?days=7&step_seconds=60
```

Use `instance=<name>` when you want to backfill only one Prometheus instance. Backfill runs are recorded in `background_sync_runs` with source `prometheus_backfill`.

Live Prometheus passthrough endpoints:

```http
GET http://localhost:8000/api/instances
GET http://localhost:8000/api/device/status
GET http://localhost:8000/api/sync/runs
GET http://localhost:8000/api/telemetry/snapshots/latest
```

Prometheus-derived daily energy aggregates can be rebuilt from stored metric snapshots:

```http
POST http://localhost:8000/api/aggregates/rebuild/prometheus
GET http://localhost:8000/api/aggregates/daily
```

When background sync is enabled, `daily_energy_aggregates` is refreshed from the Prometheus energy counter after each successful sync. Since Prometheus does not expose session events yet, `total_sessions` and `average_duration_minutes` remain `0` for Prometheus-derived daily rows.

## Loki Sync

Charging/session events are read through a repository adapter. The current default is Loki:

```text
CHARGING_SESSION_SOURCE=loki
```

By default Loki import reads all `datacoremachine.service` streams that contain session payloads. Add `host_name=<name>` only when you intentionally want to import one host.

```http
POST http://localhost:8000/api/sync/loki?lookback_minutes=10080
POST http://localhost:8000/api/sync/loki?host_name=rpi-m1-ac-14-006&lookback_minutes=120
```

The route name remains `/sync/loki` for compatibility, but internally it uses the configured charging-session repository.

## Fabric Session Source

Fabric/Eventhouse can be used instead of Loki when the KQL Query URI and Azure auth are available:

```text
CHARGING_SESSION_SOURCE=fabric
FABRIC_KQL_QUERY_URI=https://<eventhouse-query-uri>
FABRIC_KQL_INGESTION_URI=https://<eventhouse-ingestion-uri>
FABRIC_KQL_DATABASE=EventsDatabase
FABRIC_KQL_TABLE=ExportEvent
FABRIC_KQL_NAME_COLUMN=Name
FABRIC_KQL_PAYLOAD_COLUMN=Payload

AZURE_TENANT_ID=<tenant id>
AZURE_CLIENT_ID=<app/client id>
AZURE_CLIENT_SECRET=<secret>
```

Local development can also use Azure CLI auth if the three `AZURE_*` app credentials are omitted and the container/runtime has `az login` access. Production should use a service principal or managed identity granted read access to the Fabric workspace/KQL database.

Expected Fabric table shape:

```text
ExportEvent
  Name
  Payload
```

The Fabric adapter parses `Payload`, unwraps nested `Payload` values if needed, and imports rows that contain `EnergyLink` or `Session`.

## Migrations

Create a migration after changing models:

```powershell
docker compose run --rm api alembic revision --autogenerate -m "describe change"
```

Apply migrations:

```powershell
docker compose run --rm api alembic upgrade head
```

Rollback one migration:

```powershell
docker compose run --rm api alembic downgrade -1
```

## Initial Design

The database separates source data from dashboard-ready data:

```text
raw_flat_rows
charging_sessions
daily_energy_aggregates
vehicle_daily_aggregates
charger_daily_aggregates
```

Use the database for session history and aggregated dashboard queries. Keep Prometheus for live telemetry.
