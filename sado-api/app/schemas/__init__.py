"""Pydantic v2 request/response schemas."""

from app.schemas.assessment import (
    AnalysisDetailedPublic,
    AnalysisPublic,
    AssessmentAnalysisResponse,
    AssessmentCreate,
    AssessmentDetailedAnalysisResponse,
    AssessmentPage,
    AssessmentPublic,
    AssessmentUpdate,
    AudioRecordingPublic,
)
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
from app.schemas.exercise import (
    ExerciseAssignmentComplete,
    ExerciseAssignmentCreate,
    ExerciseAssignmentPage,
    ExerciseAssignmentPublic,
    ExerciseAssignmentUpdate,
    ExerciseCreate,
    ExercisePage,
    ExercisePublic,
    ExerciseUpdate,
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
    "AnalysisDetailedPublic",
    "AnalysisPublic",
    "AssessmentAnalysisResponse",
    "AssessmentCreate",
    "AssessmentDetailedAnalysisResponse",
    "AssessmentPage",
    "AssessmentPublic",
    "AssessmentUpdate",
    "AudioRecordingPublic",
    "ChildCreate",
    "ChildPage",
    "ChildPublic",
    "ChildUpdate",
    "ExerciseAssignmentComplete",
    "ExerciseAssignmentCreate",
    "ExerciseAssignmentPage",
    "ExerciseAssignmentPublic",
    "ExerciseAssignmentUpdate",
    "ExerciseCreate",
    "ExercisePage",
    "ExercisePublic",
    "ExerciseUpdate",
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
