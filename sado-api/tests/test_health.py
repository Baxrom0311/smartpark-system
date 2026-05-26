"""Tests for the health check endpoints."""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_root_returns_service_metadata(client) -> None:
    response = await client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["service"]
    assert body["version"]
    assert body["docs"] == "/docs"
    assert body["health"].endswith("/health")


@pytest.mark.asyncio
async def test_health_liveness_ok(client) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"]
    assert body["version"]
    assert body["environment"] == "test"
    assert "timestamp" in body


@pytest.mark.asyncio
async def test_health_response_includes_request_id_header(client) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.headers.get("X-Request-ID")


@pytest.mark.asyncio
async def test_health_detailed_returns_service_breakdown(client) -> None:
    response = await client.get("/api/v1/health/detailed")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"ok", "degraded"}
    names = {svc["name"] for svc in body["services"]}
    assert {"database", "redis", "storage"}.issubset(names)
    for svc in body["services"]:
        assert svc["status"] in {"ok", "degraded", "down", "skipped"}


@pytest.mark.asyncio
async def test_unknown_route_returns_consistent_error(client) -> None:
    response = await client.get("/api/v1/this-route-does-not-exist")
    assert response.status_code == 404
    body = response.json()
    # FastAPI's default 404 keeps {"detail": ...} which our error
    # contract is compatible with.
    assert "detail" in body


@pytest.mark.asyncio
async def test_openapi_schema_lists_health(client) -> None:
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    paths = schema.get("paths", {})
    assert "/api/v1/health" in paths
    assert "/api/v1/health/detailed" in paths
