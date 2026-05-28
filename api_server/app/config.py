from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Elonroad Energy API"
    database_url: str = "postgresql+psycopg://elonroad:elonroad@db:5432/elonroad"
    data_tenant_key: str = "loki"

    prometheus_base_url: str | None = None
    loki_base_url: str | None = None
    prometheus_username: str | None = None
    prometheus_password: str | None = None
    loki_username: str | None = None
    loki_password: str | None = None
    prometheus_default_instance: str = "rpi-m1-ac-14-006"
    prometheus_sync_enabled: bool = False
    prometheus_sync_interval_seconds: int = Field(default=60, ge=10, le=3600)
    loki_default_host_name: str = "rpi-m1-ac-14-006"
    loki_sync_enabled: bool = False
    loki_sync_interval_seconds: int = Field(default=300, ge=30, le=3600)
    loki_sync_lookback_minutes: int = Field(default=120, ge=1, le=10080)
    charging_session_source: Literal["loki", "fabric"] = "loki"
    events_sync_enabled: bool | None = None
    events_startup_lookback_days: int = Field(default=0, ge=0, le=365)
    events_startup_chunk_hours: int = Field(default=24, ge=1, le=168)
    session_event_sync_enabled: bool | None = None

    fabric_kql_query_uri: str | None = None
    fabric_kql_ingestion_uri: str | None = None
    fabric_kql_database: str | None = None
    fabric_kql_table: str = "ExportEvent"
    fabric_kql_name_column: str = "Name"
    fabric_kql_payload_column: str = "Payload"
    azure_tenant_id: str | None = None
    azure_client_id: str | None = None
    azure_client_secret: str | None = None

    api_cors_origins: str = Field(default="http://localhost:5173,http://127.0.0.1:5173")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.api_cors_origins.split(",") if origin.strip()]

    @property
    def prometheus_configured(self) -> bool:
        return bool(self.prometheus_base_url and self.prometheus_username and self.prometheus_password)

    @property
    def loki_auth(self) -> tuple[str, str] | None:
        username = self.loki_username or self.prometheus_username
        password = self.loki_password or self.prometheus_password
        if username and password:
            return username, password
        return None

    @property
    def loki_configured(self) -> bool:
        return bool(self.loki_base_url and self.loki_auth)

    @property
    def fabric_configured(self) -> bool:
        return bool(self.fabric_kql_query_uri and self.fabric_kql_database and self.fabric_kql_table)

    @property
    def charging_session_source_configured(self) -> bool:
        if self.charging_session_source == "fabric":
            return self.fabric_configured
        return self.loki_configured

    @property
    def charging_session_sync_enabled(self) -> bool:
        if self.session_event_sync_enabled is not None:
            return self.session_event_sync_enabled
        if self.events_sync_enabled is not None:
            return self.events_sync_enabled
        return self.loki_sync_enabled


@lru_cache
def get_settings() -> Settings:
    return Settings()
