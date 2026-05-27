"""ORM models — every module imports here so ``Base.metadata`` is full.

Importing :mod:`app.models` registers all tables on the declarative
base, which is what Alembic and ``Base.metadata.create_all()`` depend on.
"""

from __future__ import annotations

from app.models.child import Child
from app.models.kindergarten import Kindergarten
from app.models.region import Region, RegionType
from app.models.user import User, UserLanguage, UserRole

__all__ = [
    "Child",
    "Kindergarten",
    "Region",
    "RegionType",
    "User",
    "UserLanguage",
    "UserRole",
]
