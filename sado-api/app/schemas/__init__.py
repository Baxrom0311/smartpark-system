"""Pydantic v2 request/response schemas."""

from app.schemas.auth import (
    LoginRequest,
    LogoutResponse,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
)
from app.schemas.child import (
    ChildCreate,
    ChildPage,
    ChildPublic,
    ChildUpdate,
)
from app.schemas.kindergarten import (
    KindergartenCreate,
    KindergartenPage,
    KindergartenPublic,
    KindergartenStats,
    KindergartenUpdate,
)
from app.schemas.region import (
    RegionCreate,
    RegionPage,
    RegionPublic,
    RegionUpdate,
)
from app.schemas.user import UserPublic, UserUpdate

__all__ = [
    "ChildCreate",
    "ChildPage",
    "ChildPublic",
    "ChildUpdate",
    "KindergartenCreate",
    "KindergartenPage",
    "KindergartenPublic",
    "KindergartenStats",
    "KindergartenUpdate",
    "LoginRequest",
    "LogoutResponse",
    "RefreshRequest",
    "RegionCreate",
    "RegionPage",
    "RegionPublic",
    "RegionUpdate",
    "RegisterRequest",
    "TokenPair",
    "UserPublic",
    "UserUpdate",
]
