/**
 * Tests for FB-E1: Enterprise Auth Wiring into App Factory
 *
 * Tests auth middleware integration, RBAC enforcement, rate limiting,
 * resume-token bypass, and backward compatibility with auth disabled.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createFormBridgeAppWithIntakes } from '../../src/app.js';
import type { AuthConfig } from '../../src/auth/middleware.js';
import { InMemoryApiKeyStore, hashApiKey } from '../../src/auth/api-key-auth.js';
import { RateLimiter } from '../../src/auth/rate-limiter.js';
import type { IntakeDefinition } from '../../src/submission-types.js';

const TEST_INTAKE: IntakeDefinition = {
  id: 'test-intake',
  name: 'Test Intake',
  version: '1.0.0',
  description: 'Test intake for auth tests',
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
    },
    required: ['name'],
  },
  destination: {
    kind: 'webhook',
    url: 'https://example.com/test-webhook',
  },
};

function createTestApp(authConfig?: AuthConfig) {
  return createFormBridgeAppWithIntakes([TEST_INTAKE], {
    auth: authConfig ?? { enabled: false },
  });
}

function createAuthEnabledApp(overrides?: Partial<AuthConfig>) {
  const apiKeyStore = new InMemoryApiKeyStore();
  // Create admin key
  const adminResult = apiKeyStore.create({
    name: 'admin-key',
    tenantId: 'tenant-1',
    operations: ['admin'],
  });
  // Create read-only key
  const viewerResult = apiKeyStore.create({
    name: 'viewer-key',
    tenantId: 'tenant-1',
    operations: ['read'],
  });
  // Create reviewer key
  const reviewerResult = apiKeyStore.create({
    name: 'reviewer-key',
    tenantId: 'tenant-1',
    operations: ['approve'],
  });

  const config: AuthConfig = {
    enabled: true,
    apiKeyStore,
    rateLimiter: new RateLimiter({ maxRequests: 100, windowMs: 60000 }),
    defaultRole: 'viewer',
    ...overrides,
  };

  return {
    app: createFormBridgeAppWithIntakes([TEST_INTAKE], { auth: config }),
    adminKey: adminResult.rawKey,
    viewerKey: viewerResult.rawKey,
    reviewerKey: reviewerResult.rawKey,
    config,
  };
}

// Helper to make requests
function req(app: ReturnType<typeof createTestApp>, method: string, path: string, opts?: { body?: unknown; headers?: Record<string, string> }) {
  const init: RequestInit = { method, headers: { ...opts?.headers } };
  if (opts?.body) {
    init.body = JSON.stringify(opts.body);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  return app.request(path, init);
}

// =============================================================================
// § Auth Disabled (Default — Backward Compatibility)
// =============================================================================

describe('Auth Disabled (FORMBRIDGE_AUTH_ENABLED=false)', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp({ enabled: false });
  });

  it('allows unauthenticated requests to intake routes', async () => {
    const res = await req(app, 'GET', '/intake/test-intake/schema');
    expect(res.status).toBe(200);
  });

  it('allows unauthenticated submission creation', async () => {
    const res = await req(app, 'POST', '/intake/test-intake/submissions', {
      body: { actor: { kind: 'system', id: 'test', name: 'Test' } },
    });
    expect(res.status).toBe(201);
  });

  it('allows unauthenticated analytics access', async () => {
    const res = await req(app, 'GET', '/analytics/summary');
    expect(res.status).toBe(200);
  });

  it('allows unauthenticated webhook access', async () => {
    const res = await req(app, 'GET', '/webhooks/deliveries/nonexistent');
    // 404 is fine — it means auth passed
    expect([200, 404]).toContain(res.status);
  });
});

// =============================================================================
// § Auth Enabled — API Key Authentication
// =============================================================================

describe('Auth Enabled — API Key Auth', () => {
  it('rejects requests without Authorization header', async () => {
    const { app } = createAuthEnabledApp();
    const res = await req(app, 'GET', '/analytics/summary');
    expect(res.status).toBe(401);
  });

  it('rejects requests with invalid API key', async () => {
    const { app } = createAuthEnabledApp();
    const res = await req(app, 'GET', '/analytics/summary', {
      headers: { Authorization: 'Bearer fb_key_invalid-key' },
    });
    expect(res.status).toBe(401);
  });

  it('accepts requests with valid admin API key', async () => {
    const { app, adminKey } = createAuthEnabledApp();
    const res = await req(app, 'GET', '/analytics/summary', {
      headers: { Authorization: `Bearer ${adminKey}` },
    });
    expect(res.status).toBe(200);
  });

  it('does not accept query parameter auth', async () => {
    const { app, adminKey } = createAuthEnabledApp();
    const res = await req(app, 'GET', `/analytics/summary?api_key=${adminKey}`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// § RBAC Enforcement
// =============================================================================

describe('RBAC Permission Enforcement', () => {
  it('admin can create submissions (submission:write)', async () => {
    const { app, adminKey } = createAuthEnabledApp();
    const res = await req(app, 'POST', '/intake/test-intake/submissions', {
      headers: { Authorization: `Bearer ${adminKey}` },
      body: { actor: { kind: 'system', id: 'test', name: 'Test' } },
    });
    expect(res.status).toBe(201);
  });

  it('viewer cannot create submissions (no submission:write)', async () => {
    const { app, viewerKey } = createAuthEnabledApp();
    const res = await req(app, 'POST', '/intake/test-intake/submissions', {
      headers: { Authorization: `Bearer ${viewerKey}` },
      body: { actor: { kind: 'system', id: 'test', name: 'Test' } },
    });
    expect(res.status).toBe(403);
  });

  it('reviewer cannot create submissions (no submission:write)', async () => {
    const { app, reviewerKey } = createAuthEnabledApp();
    const res = await req(app, 'POST', '/intake/test-intake/submissions', {
      headers: { Authorization: `Bearer ${reviewerKey}` },
      body: { actor: { kind: 'system', id: 'test', name: 'Test' } },
    });
    expect(res.status).toBe(403);
  });

  it('viewer can read submissions (submission:read)', async () => {
    const { app, adminKey, viewerKey } = createAuthEnabledApp();
    // Create submission as admin first
    const createRes = await req(app, 'POST', '/intake/test-intake/submissions', {
      headers: { Authorization: `Bearer ${adminKey}` },
      body: { actor: { kind: 'system', id: 'test', name: 'Test' } },
    });
    const { submissionId } = await createRes.json() as { submissionId: string };

    // Read as viewer
    const res = await req(app, 'GET', `/intake/test-intake/submissions/${submissionId}`, {
      headers: { Authorization: `Bearer ${viewerKey}` },
    });
    expect(res.status).toBe(200);
  });

  it('viewer can read analytics (analytics:read)', async () => {
    const { app, viewerKey } = createAuthEnabledApp();
    const res = await req(app, 'GET', '/analytics/summary', {
      headers: { Authorization: `Bearer ${viewerKey}` },
    });
    expect(res.status).toBe(200);
  });

  it('viewer can read webhooks (webhook:read)', async () => {
    const { app, viewerKey } = createAuthEnabledApp();
    const res = await req(app, 'GET', '/webhooks/deliveries/nonexistent', {
      headers: { Authorization: `Bearer ${viewerKey}` },
    });
    // 404 means auth + permission passed
    expect([200, 404]).toContain(res.status);
  });

  it('viewer cannot retry webhook deliveries (no webhook:write)', async () => {
    const { app, viewerKey } = createAuthEnabledApp();
    const res = await req(app, 'POST', '/webhooks/deliveries/some-id/retry', {
      headers: { Authorization: `Bearer ${viewerKey}` },
    });
    expect(res.status).toBe(403);
  });

  it('admin can retry webhook deliveries (webhook:write)', async () => {
    const { app, adminKey } = createAuthEnabledApp();
    const res = await req(app, 'POST', '/webhooks/deliveries/some-id/retry', {
      headers: { Authorization: `Bearer ${adminKey}` },
    });
    // 404 is fine — means auth + permission passed
    expect([200, 404]).toContain(res.status);
  });
});

// =============================================================================
// § Resume Token Bypass
// =============================================================================

describe('Resume Token Routes Bypass Auth', () => {
  it('GET /submissions/resume/:token works without auth when enabled', async () => {
    const { app } = createAuthEnabledApp();
    const res = await req(app, 'GET', '/submissions/resume/some-token');
    // 404 is expected (no such token) — but NOT 401
    expect(res.status).toBe(404);
  });

  it('POST /submissions/resume/:token/resumed works without auth when enabled', async () => {
    const { app } = createAuthEnabledApp();
    const res = await req(app, 'POST', '/submissions/resume/some-token/resumed');
    // 404 is expected — but NOT 401
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// § Rate Limiting
// =============================================================================

describe('Rate Limiting', () => {
  it('returns 429 when rate limit exceeded', async () => {
    const apiKeyStore = new InMemoryApiKeyStore();
    const result = apiKeyStore.create({
      name: 'limited-key',
      tenantId: 'tenant-rate',
      operations: ['admin'],
    });

    const rateLimiter = new RateLimiter({ maxRequests: 3, windowMs: 60000 });
    const app = createFormBridgeAppWithIntakes([TEST_INTAKE], {
      auth: {
        enabled: true,
        apiKeyStore,
        rateLimiter,
      },
    });

    const headers = { Authorization: `Bearer ${result.rawKey}` };

    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const res = await req(app, 'GET', '/analytics/summary', { headers });
      expect(res.status).toBe(200);
    }

    // 4th request should be rate limited
    const res = await req(app, 'GET', '/analytics/summary', { headers });
    expect(res.status).toBe(429);
    const body = await res.json() as { ok: boolean; error: { type: string } };
    expect(body.ok).toBe(false);
    expect(body.error.type).toBe('rate_limited');
  });

  it('includes rate limit headers', async () => {
    const apiKeyStore = new InMemoryApiKeyStore();
    const result = apiKeyStore.create({
      name: 'header-key',
      tenantId: 'tenant-headers',
      operations: ['admin'],
    });

    const app = createFormBridgeAppWithIntakes([TEST_INTAKE], {
      auth: {
        enabled: true,
        apiKeyStore,
        rateLimiter: new RateLimiter({ maxRequests: 100, windowMs: 60000 }),
      },
    });

    const res = await req(app, 'GET', '/analytics/summary', {
      headers: { Authorization: `Bearer ${result.rawKey}` },
    });
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy();
  });
});

// =============================================================================
// § Health/Probe Endpoints Bypass Auth
// =============================================================================

describe('Health and Probe Endpoints', () => {
  it('/health bypasses auth', async () => {
    const { app } = createAuthEnabledApp();
    const res = await req(app, 'GET', '/health');
    expect(res.status).toBe(200);
  });
});

// =============================================================================
// § Error Responses
// =============================================================================

describe('Auth Error Response Format', () => {
  it('returns proper 401 JSON on missing auth', async () => {
    const { app } = createAuthEnabledApp();
    const res = await req(app, 'GET', '/analytics/summary');
    expect(res.status).toBe(401);
    const body = await res.json() as { ok: boolean; error: { type: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.type).toBe('unauthorized');
    expect(body.error.message).toBeTruthy();
  });

  it('returns proper 403 JSON on insufficient permissions', async () => {
    const { app, viewerKey } = createAuthEnabledApp();
    const res = await req(app, 'POST', '/intake/test-intake/submissions', {
      headers: { Authorization: `Bearer ${viewerKey}` },
      body: { actor: { kind: 'system', id: 'test', name: 'Test' } },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { ok: boolean; error: { type: string } };
    expect(body.ok).toBe(false);
    expect(body.error.type).toBe('forbidden');
  });
});
