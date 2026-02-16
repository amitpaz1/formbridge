/**
 * Readiness + Startup Probe Routes (FB-E2)
 *
 * GET /ready   — checks storage backend connectivity
 * GET /startup — checks server listening + storage reachable
 */

import { Hono } from 'hono';
import type { FormBridgeStorage } from '../storage/storage-interface.js';

export interface ProbeOptions {
  storage: FormBridgeStorage;
  getIntakeCount?: () => number;
}

/**
 * Creates a Hono router with readiness and startup probe endpoints.
 */
export function createProbeRouter(options: ProbeOptions): Hono {
  const { storage, getIntakeCount } = options;
  const router = new Hono();

  /**
   * GET /ready — Readiness probe
   * Checks storage backend connectivity via healthCheck().
   */
  router.get('/ready', async (c) => {
    try {
      const result = await storage.healthCheck();
      if (result.ok) {
        return c.json({ ok: true, latencyMs: result.latencyMs }, 200);
      }
      return c.json({ ok: false, latencyMs: result.latencyMs }, 503);
    } catch {
      return c.json({ ok: false, latencyMs: 0 }, 503);
    }
  });

  /**
   * GET /startup — Startup probe
   * Checks server is listening and storage is reachable.
   * Zero intakes is valid.
   */
  router.get('/startup', async (c) => {
    try {
      const result = await storage.healthCheck();
      const intakes = getIntakeCount?.() ?? 0;

      if (result.ok) {
        return c.json({ ok: true, intakes, storageOk: true }, 200);
      }
      return c.json({ ok: false, intakes, storageOk: false }, 503);
    } catch {
      return c.json({ ok: false, intakes: 0, storageOk: false }, 503);
    }
  });

  return router;
}
