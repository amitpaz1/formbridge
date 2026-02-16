"""FormBridge async and sync HTTP clients.

Usage::

    async with FormBridgeClient() as client:
        sub = await client.create_submission("vendor-onboarding", fields={"company": "Acme"})
        result = await client.set_fields(sub.intake_id, sub.submission_id, sub.resume_token, {"email": "a@b.com"})
        final = await client.submit(sub.intake_id, sub.submission_id, result.resume_token)
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Dict, Optional

try:
    import httpx
except ImportError:
    raise ImportError("httpx is required. Install with: pip install formbridge-sdk")

from formbridge.errors import FormBridgeError
from formbridge.types import Actor, FieldsResult, Submission

logger = logging.getLogger("formbridge.client")

_DEFAULT_URL = "http://localhost:3000"
_DEFAULT_TIMEOUT = 10.0
_RETRY_BACKOFFS = [0.5, 1.0, 2.0]
_RETRYABLE_STATUS = {429, 500, 502, 503, 504}


def _serialize_actor(actor: Optional[Actor]) -> Optional[Dict[str, Any]]:
    if actor is None:
        return None
    d: Dict[str, Any] = {"kind": actor.kind, "id": actor.id}
    if actor.name is not None:
        d["name"] = actor.name
    return d


class FormBridgeClient:
    """Async HTTP client for FormBridge API.

    Parameters:
        url: Base URL. Defaults to ``FORMBRIDGE_URL`` env var or ``http://localhost:3000``.
        api_key: API key for Bearer auth. Defaults to ``FORMBRIDGE_API_KEY`` env var.
        timeout: Request timeout in seconds. Defaults to ``FORMBRIDGE_TIMEOUT`` env var or 10.
        max_retries: Max retry attempts on 429/5xx (default 3).
    """

    def __init__(
        self,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: int = 3,
    ) -> None:
        self._url = (url or os.environ.get("FORMBRIDGE_URL", _DEFAULT_URL)).rstrip("/")
        self._api_key = api_key or os.environ.get("FORMBRIDGE_API_KEY", "")
        raw_timeout = timeout if timeout is not None else os.environ.get("FORMBRIDGE_TIMEOUT")
        self._timeout = float(raw_timeout) if raw_timeout is not None else _DEFAULT_TIMEOUT
        self._max_retries = max_retries

        headers: Dict[str, str] = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        self._http = httpx.AsyncClient(
            base_url=self._url,
            headers=headers,
            timeout=self._timeout,
        )

    async def __aenter__(self) -> "FormBridgeClient":
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.close()

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.aclose()

    # ── Public API ────────────────────────────────────────────────────

    async def create_submission(
        self,
        intake_id: str,
        *,
        fields: Optional[Dict[str, Any]] = None,
        actor: Optional[Actor] = None,
        idempotency_key: Optional[str] = None,
    ) -> Submission:
        """Create a new submission.

        Args:
            intake_id: The intake definition ID.
            fields: Optional initial field values.
            actor: Optional actor performing the action.
            idempotency_key: Optional idempotency key for deduplication.

        Returns:
            Submission with id, state, resume_token, etc.

        Raises:
            FormBridgeError: On API or connectivity error.
        """
        body: Dict[str, Any] = {}
        if fields:
            body["fields"] = fields
        if actor:
            body["actor"] = _serialize_actor(actor)
        if idempotency_key:
            body["idempotencyKey"] = idempotency_key

        data = await self._request("POST", f"/intake/{intake_id}/submissions", json_data=body)
        sub = Submission.from_response(data)
        # API may not return intakeId on create; fill it in
        if not sub.intake_id:
            sub = Submission(
                submission_id=sub.submission_id,
                intake_id=intake_id,
                state=sub.state,
                resume_token=sub.resume_token,
                fields=sub.fields,
                missing_fields=sub.missing_fields,
                schema=sub.schema,
                created_at=sub.created_at,
                updated_at=sub.updated_at,
                raw=sub.raw,
            )
        return sub

    async def set_fields(
        self,
        intake_id: str,
        submission_id: str,
        resume_token: str,
        fields: Dict[str, Any],
        actor: Optional[Actor] = None,
    ) -> FieldsResult:
        """Update fields on a submission.

        Args:
            intake_id: The intake definition ID.
            submission_id: The submission ID.
            resume_token: Current resume token.
            fields: Field values to set.
            actor: Optional actor performing the action.

        Returns:
            FieldsResult with new state, resume_token (may rotate), missing_fields.

        Raises:
            FormBridgeError: On API or connectivity error.
        """
        body: Dict[str, Any] = {
            "resumeToken": resume_token,
            "fields": fields,
        }
        if actor:
            body["actor"] = _serialize_actor(actor)

        data = await self._request(
            "PATCH", f"/intake/{intake_id}/submissions/{submission_id}", json_data=body
        )
        return FieldsResult.from_response(data)

    async def submit(
        self,
        intake_id: str,
        submission_id: str,
        resume_token: str,
        *,
        actor: Optional[Actor] = None,
    ) -> Submission:
        """Submit a submission for processing.

        Args:
            intake_id: The intake definition ID.
            submission_id: The submission ID.
            resume_token: Current resume token.
            actor: Optional actor performing the action.

        Returns:
            Final Submission state.

        Raises:
            FormBridgeError: On API or connectivity error.
        """
        body: Dict[str, Any] = {"resumeToken": resume_token}
        if actor:
            body["actor"] = _serialize_actor(actor)

        data = await self._request(
            "POST", f"/intake/{intake_id}/submissions/{submission_id}/submit", json_data=body
        )
        return Submission.from_response(data)

    async def get_submission(
        self,
        intake_id: str,
        submission_id: str,
    ) -> Submission:
        """Get a submission by ID.

        Args:
            intake_id: The intake definition ID.
            submission_id: The submission ID.

        Returns:
            Submission details.

        Raises:
            FormBridgeError: On API or connectivity error.
        """
        data = await self._request(
            "GET", f"/intake/{intake_id}/submissions/{submission_id}"
        )
        return Submission.from_response(data)

    # ── Internals ─────────────────────────────────────────────────────

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json_data: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Make HTTP request with retry and graceful error handling."""
        last_exc: Optional[Exception] = None
        backoffs = _RETRY_BACKOFFS[: self._max_retries]

        for attempt in range(1 + len(backoffs)):
            try:
                resp = await self._http.request(method, path, json=json_data)

                if resp.status_code in _RETRYABLE_STATUS and attempt < len(backoffs):
                    logger.warning(
                        "FormBridge returned %d (attempt %d/%d), retrying in %.1fs",
                        resp.status_code,
                        attempt + 1,
                        len(backoffs) + 1,
                        backoffs[attempt],
                    )
                    await asyncio.sleep(backoffs[attempt])
                    continue

                data = resp.json()

                if resp.status_code >= 400:
                    error_info = data.get("error", {}) if isinstance(data, dict) else {}
                    raise FormBridgeError(
                        error_info.get("message", f"HTTP {resp.status_code}"),
                        status_code=resp.status_code,
                        error_type=error_info.get("type"),
                        response_data=data,
                    )

                return data

            except FormBridgeError:
                raise
            except (httpx.ConnectError, httpx.TimeoutException, httpx.ConnectTimeout) as exc:
                last_exc = exc
                if attempt < len(backoffs):
                    logger.warning(
                        "FormBridge connection error (attempt %d/%d): %s, retrying in %.1fs",
                        attempt + 1,
                        len(backoffs) + 1,
                        exc,
                        backoffs[attempt],
                    )
                    await asyncio.sleep(backoffs[attempt])
                    continue
                raise FormBridgeError(
                    f"Connection failed: {exc}",
                    is_connectivity_error=True,
                ) from exc
            except Exception as exc:
                raise FormBridgeError(
                    f"Unexpected error: {exc}",
                    is_connectivity_error=True,
                ) from exc

        # Should not reach here
        if last_exc:
            raise FormBridgeError(
                f"Connection failed after retries: {last_exc}",
                is_connectivity_error=True,
            ) from last_exc
        raise RuntimeError("Retry loop exhausted unexpectedly")


class FormBridgeClientSync:
    """Synchronous wrapper around FormBridgeClient.

    Works without an existing event loop. Creates its own loop internally.

    Usage::

        client = FormBridgeClientSync(api_key="sk-...")
        sub = client.create_submission("vendor-onboarding", fields={"company": "Acme"})
        client.close()
    """

    def __init__(self, **kwargs: Any) -> None:
        self._async_client = FormBridgeClient(**kwargs)

    def __enter__(self) -> "FormBridgeClientSync":
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._run(self._async_client.close())

    def create_submission(
        self,
        intake_id: str,
        *,
        fields: Optional[Dict[str, Any]] = None,
        actor: Optional[Actor] = None,
        idempotency_key: Optional[str] = None,
    ) -> Submission:
        """Create a new submission. See :meth:`FormBridgeClient.create_submission`."""
        return self._run(
            self._async_client.create_submission(
                intake_id, fields=fields, actor=actor, idempotency_key=idempotency_key
            )
        )

    def set_fields(
        self,
        intake_id: str,
        submission_id: str,
        resume_token: str,
        fields: Dict[str, Any],
        actor: Optional[Actor] = None,
    ) -> FieldsResult:
        """Update fields on a submission. See :meth:`FormBridgeClient.set_fields`."""
        return self._run(
            self._async_client.set_fields(intake_id, submission_id, resume_token, fields, actor)
        )

    def submit(
        self,
        intake_id: str,
        submission_id: str,
        resume_token: str,
        *,
        actor: Optional[Actor] = None,
    ) -> Submission:
        """Submit a submission. See :meth:`FormBridgeClient.submit`."""
        return self._run(
            self._async_client.submit(intake_id, submission_id, resume_token, actor=actor)
        )

    def get_submission(
        self,
        intake_id: str,
        submission_id: str,
    ) -> Submission:
        """Get a submission by ID. See :meth:`FormBridgeClient.get_submission`."""
        return self._run(self._async_client.get_submission(intake_id, submission_id))

    @staticmethod
    def _run(coro: Any) -> Any:
        """Run a coroutine in a new event loop (safe from any context)."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            # We're inside an async context — use a thread
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return pool.submit(asyncio.run, coro).result()
        else:
            return asyncio.run(coro)
