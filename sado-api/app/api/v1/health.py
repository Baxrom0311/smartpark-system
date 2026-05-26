"""Health check endpoints.

* ``GET /health`` — liveness probe, always returns 200 quickly.
* ``GET /health/detailed`` — checks DB / Redis / MinIO connectivity and
  reports a per-service status. Designed to be safe to call without
  authentication during local development; in later milestones it will
  be guarded for admin-only access.

The detailed probe deliberately never raises; degraded dependencies are
reported via the ``services`` map so monitoring can alert without the
endpoint going hard-down.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app import __version__
from app.config import get_settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str
    environment: str
    timestamp: datetime


class ServiceStatus(BaseModel):
    name: str
    status: Literal["ok", "degraded", "down", "skipped"]
    detail: str | None = None
    latency_ms: float | None = None


class DetailedHealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    service: str
    version: str
    environment: str
    timestamp: datetime
    services: list[ServiceStatus]


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness probe",
    description="Returns 200 OK whenever the API process is responsive.",
)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        service=settings.app_name,
        version=__version__,
        environment=settings.app_env,
        timestamp=datetime.now(timezone.utc),
    )
