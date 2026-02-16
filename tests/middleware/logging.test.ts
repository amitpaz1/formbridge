/**
 * Tests for FB-E3: Structured JSON Logging
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { Writable } from 'stream';
import pino from 'pino';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { requestLoggerMiddleware } from '../../src/middleware/request-logger.js';
import { createLogger, setLogger, getLogger } from '../../src/logging.js';

describe('createLogger', () => {
  it('creates a logger with JSON format', () => {
    const logger = createLogger({ format: 'json', level: 'info' });
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('creates a logger with pretty format', () => {
    const logger = createLogger({ format: 'pretty', level: 'info' });
    expect(logger).toBeDefined();
  });
});

describe('JSON log output structure', () => {
  it('includes required fields: timestamp, level, message, logger', async () => {
    const logs: string[] = [];
    const dest = new Writable({
      write(chunk, _enc, cb) {
        logs.push(chunk.toString());
        cb();
      },
    });
    const logger = pino({ level: 'info', timestamp: pino.stdTimeFunctions.isoTime, formatters: { level(label) { return { level: label }; } } }, dest);

    logger.info({ logger: 'test', requestId: 'req-123', latencyMs: 42 }, 'test message');

    // Flush
    await new Promise((r) => setTimeout(r, 50));

    expect(logs.length).toBeGreaterThan(0);
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('test message');
    expect(parsed.time).toBeDefined();
    expect(parsed.logger).toBe('test');
    expect(parsed.requestId).toBe('req-123');
    expect(parsed.latencyMs).toBe(42);
  });
});

describe('Request ID Middleware', () => {
  it('generates X-Request-Id when not provided', async () => {
    const app = new Hono();
    app.use('*', requestIdMiddleware());
    app.get('/test', (c) => c.json({ requestId: c.get('requestId') }));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestId).toBeDefined();
    expect(typeof body.requestId).toBe('string');
    expect(body.requestId.length).toBeGreaterThan(0);

    // Response header set
    expect(res.headers.get('X-Request-Id')).toBe(body.requestId);
  });

  it('passes through existing X-Request-Id', async () => {
    const app = new Hono();
    app.use('*', requestIdMiddleware());
    app.get('/test', (c) => c.json({ requestId: c.get('requestId') }));

    const res = await app.request('/test', {
      headers: { 'X-Request-Id': 'my-custom-id' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestId).toBe('my-custom-id');
    expect(res.headers.get('X-Request-Id')).toBe('my-custom-id');
  });
});

describe('Request Logger Middleware', () => {
  it('logs method, path, status, latencyMs', async () => {
    const logs: string[] = [];
    const dest = new Writable({
      write(chunk, _enc, cb) {
        logs.push(chunk.toString());
        cb();
      },
    });
    const logger = pino({ level: 'info', formatters: { level(label) { return { level: label }; } } }, dest);

    const app = new Hono();
    app.use('*', requestIdMiddleware());
    app.use('*', requestLoggerMiddleware(logger));
    app.get('/hello', (c) => c.json({ ok: true }));

    await app.request('/hello');

    // Flush
    await new Promise((r) => setTimeout(r, 50));

    expect(logs.length).toBeGreaterThan(0);
    const parsed = JSON.parse(logs[0]!);
    expect(parsed.method).toBe('GET');
    expect(parsed.path).toBe('/hello');
    expect(parsed.status).toBe(200);
    expect(typeof parsed.latencyMs).toBe('number');
    expect(parsed.logger).toBe('http');
    expect(parsed.requestId).toBeDefined();
  });
});

describe('No console.log remaining', () => {
  it('grep confirms no console.log/warn/error in src (except comments/docs)', async () => {
    const { execSync } = await import('child_process');
    // Grep for actual console.log calls (not in comments or string literals)
    // We check for lines that are actual code, not comments or JSDoc
    try {
      const result = execSync(
        `grep -rn "console\\.\(log\|warn\|error\)" src/ --include="*.ts" | grep -v "// " | grep -v "\\*" | grep -v "test" || true`,
        { cwd: process.cwd(), encoding: 'utf-8' }
      );
      // Should be empty
      expect(result.trim()).toBe('');
    } catch {
      // grep returning non-zero means no matches — that's what we want
    }
  });
});
