"""User-facing schemas for profile and admin user listing."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

from app.models.user import UserLanguage, UserRole

NameStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class UserPublic(BaseModel):
    """Safe user representation — never includes the password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str | None
    phone: str | None
    full_name: str
    role: UserRole
    language: UserLanguage
    is_active: bool
    is_verified: bool
    region_id: str | None
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseModel):
    """Patch payload for ``PUT /users/me``."""

    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: NameStr | None = None
    language: UserLanguage | None = None
    email: EmailStr | None = None
    region_id: str | None = Field(default=None, max_length=36)
