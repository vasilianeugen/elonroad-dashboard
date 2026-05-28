from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from app.config import Settings


class PrometheusClientError(RuntimeError):
    pass


class PrometheusClient:
    def __init__(self, settings: Settings):
        if not settings.prometheus_base_url:
            raise PrometheusClientError("PROMETHEUS_BASE_URL is not configured.")
        self.base_url = settings.prometheus_base_url.rstrip("/")
        self.auth = None
        if settings.prometheus_username and settings.prometheus_password:
            self.auth = (settings.prometheus_username, settings.prometheus_password)

    async def label_values(self, label: str) -> list[str]:
        data = await self._get(f"/api/v1/label/{label}/values")
        values = data.get("data", [])
        if not isinstance(values, list):
            raise PrometheusClientError("Unexpected Prometheus label response shape.")
        return [str(value) for value in values]

    async def query(self, promql: str) -> dict[str, Any]:
        return await self._get("/api/v1/query", params={"query": promql})

    async def query_range(
        self,
        promql: str,
        start: datetime,
        end: datetime,
        step_seconds: int,
    ) -> dict[str, Any]:
        return await self._get(
            "/api/v1/query_range",
            params={
                "query": promql,
                "start": str(start.timestamp()),
                "end": str(end.timestamp()),
                "step": str(step_seconds),
            },
        )

    async def current_metrics(self, instance: str, metric_names: list[str]) -> list[dict[str, Any]]:
        metrics: list[dict[str, Any]] = []
        for metric_name in metric_names:
            result = await self.query(f'{metric_name}{{instance="{instance}"}}')
            for item in result.get("data", {}).get("result", []):
                parsed = self._parse_vector_item(metric_name, item)
                if parsed is not None:
                    metrics.append(parsed)
        return metrics

    async def range_metrics(
        self,
        instance: str,
        metric_names: list[str],
        start: datetime,
        end: datetime,
        step_seconds: int,
    ) -> list[dict[str, Any]]:
        metrics: list[dict[str, Any]] = []
        for metric_name in metric_names:
            result = await self.query_range(
                f'{metric_name}{{instance="{instance}"}}',
                start=start,
                end=end,
                step_seconds=step_seconds,
            )
            for item in result.get("data", {}).get("result", []):
                metrics.extend(self._parse_matrix_item(metric_name, item))
        return metrics

    async def _get(self, path: str, params: dict[str, str] | None = None) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(auth=self.auth, timeout=20.0) as client:
                response = await client.get(f"{self.base_url}{path}", params=params)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise PrometheusClientError(f"Prometheus request failed: {exc}") from exc

        payload = response.json()
        if payload.get("status") != "success":
            raise PrometheusClientError(f"Prometheus returned non-success status: {payload}")
        return payload

    def _parse_vector_item(self, metric_name: str, item: dict[str, Any]) -> dict[str, Any] | None:
        value_pair = item.get("value")
        if not isinstance(value_pair, list) or len(value_pair) != 2:
            return None

        try:
            sampled_at = datetime.fromtimestamp(float(value_pair[0]), tz=timezone.utc)
            value = Decimal(str(value_pair[1]))
        except (InvalidOperation, TypeError, ValueError):
            return None
        if not value.is_finite():
            return None

        labels = dict(item.get("metric", {}))
        return {
            "metric_name": metric_name,
            "instance": labels.get("instance", ""),
            "sampled_at": sampled_at,
            "value": value,
            "labels": labels,
        }

    def _parse_matrix_item(self, metric_name: str, item: dict[str, Any]) -> list[dict[str, Any]]:
        values = item.get("values")
        if not isinstance(values, list):
            return []

        labels = dict(item.get("metric", {}))
        parsed: list[dict[str, Any]] = []
        for value_pair in values:
            if not isinstance(value_pair, list) or len(value_pair) != 2:
                continue
            try:
                sampled_at = datetime.fromtimestamp(float(value_pair[0]), tz=timezone.utc)
                value = Decimal(str(value_pair[1]))
            except (InvalidOperation, TypeError, ValueError):
                continue
            if not value.is_finite():
                continue
            parsed.append(
                {
                    "metric_name": metric_name,
                    "instance": labels.get("instance", ""),
                    "sampled_at": sampled_at,
                    "value": value,
                    "labels": labels,
                }
            )
        return parsed
