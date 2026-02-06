/**
 * Lightweight API Key Auth Middleware
 *
 * Guards routes behind a simple API key check.
 * Accepts key via:
 *   - Authorization: Bearer <key>
 *   - ?api_key=<key> query parameter
 *
 * When FORMBRIDGE_API_KEY is not set, all requests pass through (dev mode).
 */

import type { MiddlewareHandler } from 'hono';

export function createApiKeyAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const apiKey = process.env['FORMBRIDGE_API_KEY'];
    if (!apiKey) return next(); // No key configured = dev mode, allow all

    const authHeader = c.req.header('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const queryKey = c.req.query('api_key');

    if (bearerToken !== apiKey && queryKey !== apiKey) {
      return c.json(
        {
          ok: false,
          error: {
            type: 'unauthorized',
            message: 'Valid API key required',
          },
        },
        401
      );
    }
    return next();
  };
}
