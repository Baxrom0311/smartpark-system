"""API v1 package."""

from fastapi import APIRouter

from app.api.v1 import auth, children, health, users

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(children.router, tags=["children"])

__all__ = ["api_router"]
