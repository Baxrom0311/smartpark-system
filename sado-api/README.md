# sado-api

Backend REST API for the **SADO** AI speech therapy platform — built with
FastAPI, SQLAlchemy 2.0 (async), PostgreSQL, Redis, MinIO, and Celery.

This service powers:

* the parent / teacher **mobile app** (Expo),
* the speech-therapist / admin **dashboard** (React + Vite),
* and the asynchronous **audio-analysis pipeline** (Whisper STT + librosa
  feature extraction + XGBoost risk classifier — mocked locally).

---

## Quick start (development)

```bash
# 1. create a virtual environment
python3.12 -m venv .venv
source .venv/bin/activate

# 2. install the project + dev tools
pip install -e ".[dev]"

# 3. copy the env template and edit if needed
cp .env.example .env

# 4. run the API
uvicorn app.main:app --reload --port 8000
```

Then open:

* <http://localhost:8000/docs> — Swagger UI
* <http://localhost:8000/redoc> — ReDoc
* <http://localhost:8000/api/v1/health> — liveness probe

The default configuration uses **SQLite** (`./sado.db`) so the API
boots with no external dependencies. Postgres / Redis / MinIO are only
required for the production-style stack (Docker Compose, added in a
later milestone).

---

## Layout

```
sado-api/
├── app/
│   ├── main.py             # FastAPI factory
│   ├── config.py           # pydantic-settings configuration
│   ├── api/v1/             # versioned routers (health, auth, users, …)
│   ├── core/               # cross-cutting concerns (errors, middleware)
│   ├── models/             # SQLAlchemy ORM models
│   ├── schemas/            # Pydantic request/response schemas
│   ├── services/           # business logic (auth, audio, ML)
│   └── workers/            # Celery app + tasks
├── alembic/                # database migrations
├── tests/                  # pytest test-suite
├── pyproject.toml
└── .env.example
```

---

## Verification

```bash
# Type & syntax check (no deps required beyond stdlib + pydantic)
python -c "from app.main import app; print('ok')"

# Test-suite
python -m pytest -q

# Linting
python -m ruff check app tests
```

---

## Configuration

All settings are read from environment variables (or `.env`). See
[`.env.example`](./.env.example) for the full list. The most important
keys:

| Variable                | Default                          | Purpose                       |
| ----------------------- | -------------------------------- | ----------------------------- |
| `DATABASE_URL`          | `sqlite+aiosqlite:///./sado.db`  | Async SQLAlchemy URL          |
| `REDIS_URL`             | `redis://localhost:6379/0`       | Cache + rate limit backend    |
| `JWT_SECRET`            | dev-only string                  | **Must** be rotated in prod   |
| `MINIO_ENDPOINT`        | `http://localhost:9000`          | S3-compatible audio storage   |
| `CORS_ORIGINS`          | localhost dev origins            | Comma-separated allow-list    |
| `MAX_AUDIO_DURATION_SEC`| `60`                             | Hard cap on a single recording|

---

## Roadmap

The implementation follows the milestone plan in
[`../PROJECT_BRIEF.md`](../PROJECT_BRIEF.md):

1. **Foundation** — scaffold, DB models, JWT auth, core CRUD ✅ in progress
2. **Core features** — audio upload, Celery workers, ML scoring mock
3. **Polish** — tests, error handling, Docker Compose, health checks

External services (Whisper, XGBoost, push notifications) are mocked
with deterministic fakes for local development; nothing in this repo
makes paid API calls.
