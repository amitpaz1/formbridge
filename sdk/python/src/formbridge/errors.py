"""Error types for FormBridge SDK."""

from __future__ import annotations

from typing import Any, Dict, Optional


class FormBridgeError(Exception):
    """Base error for FormBridge SDK.

    Attributes:
        status_code: HTTP status code (None for connectivity errors).
        error_type: Error type from API response (e.g. 'not_found').
        is_connectivity_error: True if the error is due to a connection failure.
        response_data: Raw response body if available.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: Optional[int] = None,
        error_type: Optional[str] = None,
        is_connectivity_error: bool = False,
        response_data: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_type = error_type
        self.is_connectivity_error = is_connectivity_error
        self.response_data = response_data
