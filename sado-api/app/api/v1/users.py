"""User profile endpoints (``/users/me``)."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, DBSession
from app.core.exceptions import ConflictError
from app.models.user import User
from app.schemas.user import UserPublic, UserUpdate

router = APIRouter()


@router.get(
    "/users/me",
    response_model=UserPublic,
    summary="Read the authenticated user's profile",
)
async def read_me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)


@router.put(
    "/users/me",
    response_model=UserPublic,
    summary="Patch the authenticated user's profile",
)
async def update_me(
    payload: UserUpdate,
    user: CurrentUser,
    session: DBSession,
) -> UserPublic:
    # Only mutate fields that were actually provided.
    data = payload.model_dump(exclude_unset=True)

    # Email change requires uniqueness check.
    new_email = data.get("email")
    if new_email and new_email != user.email:
        from sqlalchemy import select

        existing = await session.execute(
            select(User).where(User.email == new_email, User.id != user.id)
        )
        if existing.scalar_one_or_none() is not None:
            raise ConflictError(
                "That email is already taken.", code="EMAIL_TAKEN"
            )
        user.email = new_email

    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"]
    if "language" in data and data["language"] is not None:
        user.language = (
            data["language"].value if hasattr(data["language"], "value") else str(data["language"])
        )
    if "region_id" in data:
        user.region_id = data["region_id"]

    await session.commit()
    await session.refresh(user)
    return UserPublic.model_validate(user)
