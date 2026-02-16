/**
 * Request ID Middleware (FB-E3)
 *
 * Generates or passes through X-Request-Id header.
 * Attaches requestId to Hono context for use in logging.
 */

import { randomUUID } from 'crypto';
import type { MiddlewareHandler } from 'hono';

/**
 * Middleware that ensures every request has a unique request ID.
 * - Reads existing X-Request-Id header (pass-through from upstream proxy)
 * - Generates a UUID v4 if none present
 * - Sets X-Request-Id on response
 * - Stores requestId in Hono context variable
 */
export function requestIdMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const requestId = c.req.header('X-Request-Id') ?? randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);
    await next();
  };
}
