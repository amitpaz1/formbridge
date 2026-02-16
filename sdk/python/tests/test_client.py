"""Unit tests for FormBridge SDK client."""

from __future__ import annotations

import pytest
import httpx
import respx

from formbridge import (
    FormBridgeClient,
    FormBridgeClientSync,
    FormBridgeError,
    Actor,
)

BASE_URL = "http://test-formbridge:3000"


@pytest.fixture
def client():
    return FormBridgeClient(url=BASE_URL, api_key="test-key")


@pytest.fixture
def sync_client():
    return FormBridgeClientSync(url=BASE_URL, api_key="test-key")


# ── Auth Header ──────────────────────────────────────────────────────


@respx.mock
async def test_auth_header(client: FormBridgeClient):
    """Bearer token sent on all requests."""
    route = respx.get(f"{BASE_URL}/intake/test/submissions/sub1").mock(
        return_value=httpx.Response(200, json={
            "ok": True, "submissionId": "sub1", "intakeId": "test",
            "state": "draft", "fields": {},
        })
    )
    await client.get_submission("test", "sub1")
    assert route.called
    assert route.calls[0].request.headers["authorization"] == "Bearer test-key"
    await client.close()


# ── create_submission ─────────────────────────────────────────────────


@respx.mock
async def test_create_submission_success(client: FormBridgeClient):
    respx.post(f"{BASE_URL}/intake/vendor/submissions").mock(
        return_value=httpx.Response(201, json={
            "ok": True,
            "submissionId": "sub_123",
            "state": "in_progress",
            "resumeToken": "tok_abc",
            "schema": {"type": "object"},
            "missingFields": ["email"],
        })
    )

    sub = await client.create_submission(
        "vendor",
        fields={"company": "Acme"},
        actor=Actor(kind="agent", id="agent-1", name="Bot"),
        idempotency_key="idem-1",
    )
    assert sub.submission_id == "sub_123"
    assert sub.state == "in_progress"
    assert sub.resume_token == "tok_abc"
    assert sub.missing_fields == ["email"]
    assert sub.intake_id == "vendor"
    await client.close()


# ── set_fields ────────────────────────────────────────────────────────


@respx.mock
async def test_set_fields_success(client: FormBridgeClient):
    respx.patch(f"{BASE_URL}/intake/vendor/submissions/sub_123").mock(
        return_value=httpx.Response(200, json={
            "ok": True,
            "submissionId": "sub_123",
            "state": "in_progress",
            "resumeToken": "tok_new",
            "missingFields": [],
        })
    )

    result = await client.set_fields(
        "vendor", "sub_123", "tok_abc", {"email": "a@b.com"},
        actor=Actor(kind="agent", id="agent-1"),
    )
    assert result.submission_id == "sub_123"
    assert result.resume_token == "tok_new"
    await client.close()


# ── submit ────────────────────────────────────────────────────────────


@respx.mock
async def test_submit_success(client: FormBridgeClient):
    respx.post(f"{BASE_URL}/intake/vendor/submissions/sub_123/submit").mock(
        return_value=httpx.Response(200, json={
            "ok": True,
            "submissionId": "sub_123",
            "intakeId": "vendor",
            "state": "submitted",
        })
    )

    sub = await client.submit("vendor", "sub_123", "tok_abc")
    assert sub.state == "submitted"
    await client.close()


# ── get_submission ────────────────────────────────────────────────────


@respx.mock
async def test_get_submission_success(client: FormBridgeClient):
    respx.get(f"{BASE_URL}/intake/vendor/submissions/sub_123").mock(
        return_value=httpx.Response(200, json={
            "ok": True,
            "submissionId": "sub_123",
            "intakeId": "vendor",
            "state": "draft",
            "fields": {"company": "Acme"},
            "metadata": {"createdAt": "2026-01-01T00:00:00Z"},
        })
    )

    sub = await client.get_submission("vendor", "sub_123")
    assert sub.submission_id == "sub_123"
    assert sub.fields == {"company": "Acme"}
    assert sub.created_at == "2026-01-01T00:00:00Z"
    await client.close()


# ── Retry on 429 ──────────────────────────────────────────────────────


@respx.mock
async def test_retry_on_429(client: FormBridgeClient):
    """Should retry on 429 and succeed on subsequent attempt."""
    route = respx.get(f"{BASE_URL}/intake/v/submissions/s1")
    route.side_effect = [
        httpx.Response(429, json={"ok": False, "error": {"type": "rate_limited"}}),
        httpx.Response(200, json={
            "ok": True, "submissionId": "s1", "intakeId": "v", "state": "draft", "fields": {},
        }),
    ]

    # Override backoffs for fast test
    import formbridge.client as mod
    original = mod._RETRY_BACKOFFS
    mod._RETRY_BACKOFFS = [0.01, 0.01, 0.01]
    try:
        sub = await client.get_submission("v", "s1")
        assert sub.submission_id == "s1"
        assert route.call_count == 2
    finally:
        mod._RETRY_BACKOFFS = original
    await client.close()


# ── Retry on 5xx then fail ────────────────────────────────────────────


@respx.mock
async def test_retry_5xx_then_fail(client: FormBridgeClient):
    """After max retries on 5xx, should raise FormBridgeError."""
    route = respx.get(f"{BASE_URL}/intake/v/submissions/s1")
    route.side_effect = [
        httpx.Response(502, json={"ok": False, "error": {"type": "bad_gateway", "message": "down"}}),
        httpx.Response(502, json={"ok": False, "error": {"type": "bad_gateway", "message": "down"}}),
        httpx.Response(502, json={"ok": False, "error": {"type": "bad_gateway", "message": "down"}}),
        httpx.Response(502, json={"ok": False, "error": {"type": "bad_gateway", "message": "down"}}),
    ]

    import formbridge.client as mod
    original = mod._RETRY_BACKOFFS
    mod._RETRY_BACKOFFS = [0.01, 0.01, 0.01]
    try:
        with pytest.raises(FormBridgeError) as exc_info:
            await client.get_submission("v", "s1")
        assert exc_info.value.status_code == 502
        assert route.call_count == 4  # 1 initial + 3 retries
    finally:
        mod._RETRY_BACKOFFS = original
    await client.close()


# ── No retry on 400/401/403 ──────────────────────────────────────────


@respx.mock
async def test_no_retry_on_client_errors(client: FormBridgeClient):
    """Should NOT retry on 400, 401, 403."""
    route = respx.get(f"{BASE_URL}/intake/v/submissions/s1")
    route.mock(return_value=httpx.Response(401, json={
        "ok": False, "error": {"type": "unauthorized", "message": "bad key"},
    }))

    with pytest.raises(FormBridgeError) as exc_info:
        await client.get_submission("v", "s1")
    assert exc_info.value.status_code == 401
    assert route.call_count == 1
    await client.close()


# ── Connection refused → graceful error ───────────────────────────────


@respx.mock
async def test_connection_refused():
    """Connection error should produce FormBridgeError with is_connectivity_error=True."""
    route = respx.get(f"{BASE_URL}/intake/v/submissions/s1")
    route.side_effect = httpx.ConnectError("Connection refused")

    import formbridge.client as mod
    original = mod._RETRY_BACKOFFS
    mod._RETRY_BACKOFFS = [0.01, 0.01, 0.01]

    client = FormBridgeClient(url=BASE_URL, api_key="test-key")
    try:
        with pytest.raises(FormBridgeError) as exc_info:
            await client.get_submission("v", "s1")
        assert exc_info.value.is_connectivity_error is True
        assert "Connection" in str(exc_info.value)
    finally:
        mod._RETRY_BACKOFFS = original
        await client.close()


# ── Sync client ───────────────────────────────────────────────────────


@respx.mock
def test_sync_client_create(sync_client: FormBridgeClientSync):
    """Sync wrapper should work without event loop."""
    respx.post(f"{BASE_URL}/intake/vendor/submissions").mock(
        return_value=httpx.Response(201, json={
            "ok": True,
            "submissionId": "sub_sync",
            "state": "draft",
            "resumeToken": "tok_s",
        })
    )

    sub = sync_client.create_submission("vendor", fields={"name": "Test"})
    assert sub.submission_id == "sub_sync"
    sync_client.close()


# ── API key not leaked in logs ────────────────────────────────────────


def test_api_key_not_in_repr():
    """API key should not appear in string representations."""
    client = FormBridgeClient(api_key="super-secret-key-123")
    assert "super-secret-key-123" not in repr(client)
    assert "super-secret-key-123" not in str(client)
