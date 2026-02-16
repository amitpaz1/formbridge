/**
 * Rate Limiter — Per-key rate limiting using a sliding window.
 *
 * Supports two backends:
 * - `memory` (default): In-process Map-based sliding window
 * - `redis`: Redis-backed sliding window via sorted sets (requires ioredis)
 *
 * Backend selection: `RATE_LIMIT_BACKEND=memory|redis` env var.
 * Redis URL: `REDIS_URL` env var (default: `redis://localhost:6379`).
 *
 * Redis fail-open: if Redis is unreachable, logs a warning and allows the request.
 */

// =============================================================================
// § Types
// =============================================================================

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

/** Common interface for rate limiter backends */
export interface RateLimiterBackend {
  check(key: string): RateLimitResult | Promise<RateLimitResult>;
  reset(key: string): void | Promise<void>;
}

// =============================================================================
// § Memory Backend
// =============================================================================

export class MemoryRateLimiter implements RateLimiterBackend {
  private readonly config: RateLimitConfig;
  /** Map of key -> array of request timestamps */
  private readonly windows: Map<string, number[]> = new Map();
  private checkCount = 0;
  private readonly cleanupEvery: number;

  constructor(config: RateLimitConfig, cleanupEvery = 100) {
    this.config = config;
    this.cleanupEvery = cleanupEvery;
  }

  /**
   * Check if a request is allowed and record it if so.
   */
  check(key: string): RateLimitResult {
    if (++this.checkCount >= this.cleanupEvery) {
      this.checkCount = 0;
      this.cleanup();
    }

    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or create window
    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Remove expired entries
    const activeTimestamps = timestamps.filter((t) => t > windowStart);
    this.windows.set(key, activeTimestamps);

    const remaining = Math.max(0, this.config.maxRequests - activeTimestamps.length);
    const resetAt = activeTimestamps.length > 0
      ? activeTimestamps[0]! + this.config.windowMs
      : now + this.config.windowMs;

    if (activeTimestamps.length >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit: this.config.maxRequests,
      };
    }

    // Record this request
    activeTimestamps.push(now);

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt,
      limit: this.config.maxRequests,
    };
  }

  /**
   * Reset the rate limit for a key.
   */
  reset(key: string): void {
    this.windows.delete(key);
  }

  /**
   * Clean up expired windows.
   */
  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, timestamps] of this.windows.entries()) {
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, active);
      }
    }
  }
}

// =============================================================================
// § Redis Backend
// =============================================================================

export class RedisRateLimiter implements RateLimiterBackend {
  private readonly config: RateLimitConfig;
  private redis: import('ioredis').default | null = null;
  private readonly redisUrl: string;
  private readonly keyPrefix: string;
  private connected = false;

  constructor(config: RateLimitConfig, redisUrl?: string, keyPrefix = 'fb:rl:') {
    this.config = config;
    this.redisUrl = redisUrl || process.env['REDIS_URL'] || 'redis://localhost:6379';
    this.keyPrefix = keyPrefix;
    this.initRedis();
  }

  private initRedis(): void {
    try {
      // Dynamic import to keep ioredis optional
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require('ioredis') as typeof import('ioredis').default;
      this.redis = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)),
        lazyConnect: false,
        enableOfflineQueue: false,
      });
      this.redis.on('connect', () => { this.connected = true; });
      this.redis.on('error', () => { this.connected = false; });
      this.redis.on('close', () => { this.connected = false; });
    } catch {
      console.warn('[FormBridge] ioredis not available, Redis rate limiter will fail-open');
      this.redis = null;
    }
  }

  private failOpen(): RateLimitResult {
    console.warn('[FormBridge] Redis rate limiter unreachable, allowing request (fail-open)');
    const now = Date.now();
    return {
      allowed: true,
      remaining: this.config.maxRequests - 1,
      resetAt: now + this.config.windowMs,
      limit: this.config.maxRequests,
    };
  }

  async check(key: string): Promise<RateLimitResult> {
    if (!this.redis || !this.connected) {
      return this.failOpen();
    }

    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const redisKey = `${this.keyPrefix}${key}`;

    try {
      // Sliding window using sorted set:
      // 1. Remove entries older than window
      // 2. Count current entries
      // 3. If under limit, add new entry
      // 4. Set TTL on key
      const pipeline = this.redis.pipeline();
      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      pipeline.zcard(redisKey);
      pipeline.zrange(redisKey, 0, 0, 'WITHSCORES');
      const results = await pipeline.exec();

      if (!results) return this.failOpen();

      const count = (results[1]?.[1] as number) || 0;
      const oldestScores = results[2]?.[1] as string[] | undefined;
      const oldestTimestamp = oldestScores && oldestScores.length >= 2
        ? Number(oldestScores[1])
        : now;

      const resetAt = count > 0
        ? oldestTimestamp + this.config.windowMs
        : now + this.config.windowMs;

      if (count >= this.config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          limit: this.config.maxRequests,
        };
      }

      // Add this request
      const addPipeline = this.redis.pipeline();
      addPipeline.zadd(redisKey, now.toString(), `${now}:${Math.random().toString(36).slice(2, 8)}`);
      addPipeline.pexpire(redisKey, this.config.windowMs);
      await addPipeline.exec();

      return {
        allowed: true,
        remaining: Math.max(0, this.config.maxRequests - count - 1),
        resetAt,
        limit: this.config.maxRequests,
      };
    } catch {
      return this.failOpen();
    }
  }

  async reset(key: string): Promise<void> {
    if (this.redis && this.connected) {
      try {
        await this.redis.del(`${this.keyPrefix}${key}`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
      this.redis = null;
      this.connected = false;
    }
  }
}

// =============================================================================
// § Unified RateLimiter (backward-compatible wrapper)
// =============================================================================

/**
 * Unified rate limiter that delegates to the configured backend.
 * Maintains backward compatibility with the original RateLimiter API.
 */
export class RateLimiter implements RateLimiterBackend {
  private readonly backend: RateLimiterBackend;

  constructor(config: RateLimitConfig, cleanupEvery = 100) {
    const backendType = process.env['RATE_LIMIT_BACKEND'] || 'memory';

    if (backendType === 'redis') {
      this.backend = new RedisRateLimiter(config);
    } else {
      this.backend = new MemoryRateLimiter(config, cleanupEvery);
    }
  }

  check(key: string): RateLimitResult | Promise<RateLimitResult> {
    return this.backend.check(key);
  }

  reset(key: string): void | Promise<void> {
    return this.backend.reset(key);
  }
}
