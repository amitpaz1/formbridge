"""Response types for FormBridge SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class Actor:
    """Submission actor."""

    kind: str
    id: str
    name: Optional[str] = None


@dataclass(frozen=True)
class Submission:
    """Submission returned by the API."""

    submission_id: str
    intake_id: str
    state: str
    resume_token: Optional[str] = None
    fields: Dict[str, Any] = field(default_factory=dict)
    missing_fields: Optional[List[str]] = None
    schema: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_response(cls, data: Dict[str, Any]) -> "Submission":
        """Parse API response into a Submission."""
        return cls(
            submission_id=data.get("submissionId", ""),
            intake_id=data.get("intakeId", ""),
            state=data.get("state", ""),
            resume_token=data.get("resumeToken"),
            fields=data.get("fields", {}),
            missing_fields=data.get("missingFields"),
            schema=data.get("schema"),
            created_at=data.get("metadata", {}).get("createdAt")
            if isinstance(data.get("metadata"), dict)
            else data.get("createdAt"),
            updated_at=data.get("metadata", {}).get("updatedAt")
            if isinstance(data.get("metadata"), dict)
            else data.get("updatedAt"),
            raw=data,
        )


@dataclass(frozen=True)
class FieldsResult:
    """Result from set_fields."""

    submission_id: str
    state: str
    resume_token: str
    missing_fields: Optional[List[str]] = None
    raw: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_response(cls, data: Dict[str, Any]) -> "FieldsResult":
        """Parse API response into a FieldsResult."""
        return cls(
            submission_id=data.get("submissionId", ""),
            state=data.get("state", ""),
            resume_token=data.get("resumeToken", ""),
            missing_fields=data.get("missingFields"),
            raw=data,
        )
