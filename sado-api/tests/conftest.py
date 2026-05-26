"""Shared pytest fixtures for the sado-api test-suite.

Tests run against the FastAPI app with the SQLite + in-memory defaults,
so no external services (Postgres, Redis, MinIO) are required.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Iterator

import pytest

# Set test-friendly defaults BEFORE the app module is imported. Settings
# are cached via lru_cache so this must happen at import time.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-secret-which-is-long-enough-1234567890")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test_sado.db")
os.environ.setdefault("CELERY_TASK_ALWAYS_EAGER", "true")


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture()
def app():
    """Return a fresh FastAPI app instance for each test."""

    from app.config import get_settings
    from app.main import create_app

    get_settings.cache_clear()
    return create_app()


@pytest.fixture()
async def client(app) -> AsyncIterator:
    """Async HTTP client wired to the in-process FastAPI app."""

    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.fixture(autouse=True)
def _cleanup_test_db() -> Iterator[None]:
    """Remove the SQLite test database file after each test session run."""

    yield
    for path in ("./test_sado.db", "./test_sado.db-journal"):
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
