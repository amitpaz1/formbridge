/**
 * Request Logging Middleware (FB-E3)
 *
 * Logs method, path, status code, and latency for every request.
 * Uses pino structured logger with request ID correlation.
 */

import type { MiddlewareHandler } from 'hono';
import type { Logger } from 'pino';

/**
 * Creates middleware that logs every HTTP request with structured fields.
 */
export function requestLoggerMiddleware(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const latencyMs = Date.now() - start;

    const requestId = c.get('requestId') as string | undefined;
    const method = c.req.method;
    const path = c.req.path;
    const status = c.res.status;

    logger.info(
      {
        requestId,
        method,
        path,
        status,
        latencyMs,
        logger: 'http',
      },
      `${method} ${path} ${status} ${latencyMs}ms`
    );
  };
}
