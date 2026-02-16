/**
 * Tests for FB-E2: Readiness + Startup Probes
 */

import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createProbeRouter } from '../../src/routes/probes.js';
import type { FormBridgeStorage } from '../../src/storage/storage-interface.js';

// Minimal mock storage
function createMockStorage(healthy = true): FormBridgeStorage {
  return {
    submissions: {} as any,
    events: {} as any,
    files: {} as any,
    initialize: async () => {},
    close: async () => {},
    healthCheck: async () => {
      if (!healthy) return { ok: false, latencyMs: 0 };
      return { ok: true, latencyMs: 1 };
    },
  };
}

describe('Readiness Probe (GET /ready)', () => {
  it('returns 200 when storage is healthy', async () => {
    const app = new Hono();
    app.route('/', createProbeRouter({ storage: createMockStorage(true) }));

    const res = await app.request('/ready');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.latencyMs).toBe('number');
  });

  it('returns 503 when storage is unhealthy', async () => {
    const app = new Hono();
    app.route('/', createProbeRouter({ storage: createMockStorage(false) }));

    const res = await app.request('/ready');
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('returns 503 when healthCheck throws', async () => {
    const storage = createMockStorage();
    storage.healthCheck = async () => { throw new Error('connection refused'); };

    const app = new Hono();
    app.route('/', createProbeRouter({ storage }));

    const res = await app.request('/ready');
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});

describe('Startup Probe (GET /startup)', () => {
  it('returns 200 with zero intakes when storage is healthy', async () => {
    const app = new Hono();
    app.route('/', createProbeRouter({
      storage: createMockStorage(true),
      getIntakeCount: () => 0,
    }));

    const res = await app.request('/startup');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.intakes).toBe(0);
    expect(body.storageOk).toBe(true);
  });

  it('returns 200 with intakes when storage is healthy', async () => {
    const app = new Hono();
    app.route('/', createProbeRouter({
      storage: createMockStorage(true),
      getIntakeCount: () => 3,
    }));

    const res = await app.request('/startup');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.intakes).toBe(3);
    expect(body.storageOk).toBe(true);
  });

  it('returns 503 when storage is unreachable', async () => {
    const app = new Hono();
    app.route('/', createProbeRouter({
      storage: createMockStorage(false),
      getIntakeCount: () => 2,
    }));

    const res = await app.request('/startup');
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.storageOk).toBe(false);
  });

  it('returns 503 when healthCheck throws', async () => {
    const storage = createMockStorage();
    storage.healthCheck = async () => { throw new Error('boom'); };

    const app = new Hono();
    app.route('/', createProbeRouter({ storage }));

    const res = await app.request('/startup');
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.storageOk).toBe(false);
  });
});

describe('Existing health endpoint unchanged', () => {
  it('GET /health still returns 200 with ok + timestamp', async () => {
    // Use the full app factory to confirm /health is untouched
    const { createFormBridgeApp } = await import('../../src/app.js');
    const app = createFormBridgeApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.timestamp).toBeDefined();
  });
});
