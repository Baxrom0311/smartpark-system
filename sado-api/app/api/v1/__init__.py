"""API v1 package."""

from fastapi import APIRouter

from app.api.v1 import health

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])

__all__ = ["api_router"]
