/**
 * Tests for rate limiter backends (memory + redis).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { MemoryRateLimiter, RedisRateLimiter, RateLimiter, type RateLimitConfig } from '../../src/auth/rate-limiter.js';

const config: RateLimitConfig = { maxRequests: 3, windowMs: 1000 };

// =============================================================================
// § Memory Backend Tests
// =============================================================================

describe('MemoryRateLimiter', () => {
  let limiter: MemoryRateLimiter;

  beforeEach(() => {
    limiter = new MemoryRateLimiter(config);
  });

  it('allows requests under the limit', () => {
    const r1 = limiter.check('key1');
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r1.limit).toBe(3);
  });

  it('blocks requests over the limit', () => {
    limiter.check('key1');
    limiter.check('key1');
    limiter.check('key1');
    const r4 = limiter.check('key1');
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('isolates keys', () => {
    limiter.check('a');
    limiter.check('a');
    limiter.check('a');
    const rb = limiter.check('b');
    expect(rb.allowed).toBe(true);
  });

  it('resets a key', () => {
    limiter.check('key1');
    limiter.check('key1');
    limiter.check('key1');
    limiter.reset('key1');
    const r = limiter.check('key1');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it('returns consistent X-RateLimit-* fields', () => {
    const r = limiter.check('key1');
    expect(r).toHaveProperty('limit');
    expect(r).toHaveProperty('remaining');
    expect(r).toHaveProperty('resetAt');
    expect(typeof r.resetAt).toBe('number');
  });
});

// =============================================================================
// § Redis Backend Tests (skip if Redis not available)
// =============================================================================

const REDIS_URL = process.env['REDIS_URL'] || 'redis://localhost:6379';

async function isRedisAvailable(): Promise<boolean> {
  try {
    const Redis = (await import('ioredis')).default;
    const client = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch {
    return false;
  }
}

describe('RedisRateLimiter', async () => {
  const redisAvailable = await isRedisAvailable();
  let limiter: RedisRateLimiter | null = null;

  if (!redisAvailable) {
    it.skip('Redis not available — skipping Redis rate limiter tests', () => {});
    return;
  }

  beforeEach(() => {
    limiter = new RedisRateLimiter(config, REDIS_URL, `fb:rl:test:${Date.now()}:`);
  });

  afterAll(async () => {
    if (limiter) await limiter.disconnect();
  });

  it('allows requests under the limit', async () => {
    const r = await limiter!.check('key1');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
    expect(r.limit).toBe(3);
  });

  it('blocks requests over the limit', async () => {
    await limiter!.check('key1');
    await limiter!.check('key1');
    await limiter!.check('key1');
    const r4 = await limiter!.check('key1');
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('returns consistent header fields', async () => {
    const r = await limiter!.check('key1');
    expect(r).toHaveProperty('limit');
    expect(r).toHaveProperty('remaining');
    expect(r).toHaveProperty('resetAt');
    expect(typeof r.resetAt).toBe('number');
  });
});

// =============================================================================
// § Unified RateLimiter (default = memory)
// =============================================================================

describe('RateLimiter (unified)', () => {
  it('defaults to memory backend', () => {
    delete process.env['RATE_LIMIT_BACKEND'];
    const limiter = new RateLimiter(config);
    const r = limiter.check('key1');
    // Memory backend returns sync result
    expect(r).toHaveProperty('allowed');
  });
});
