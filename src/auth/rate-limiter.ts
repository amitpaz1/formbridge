/**
 * Rate Limiter — Per-key rate limiting using a sliding window.
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

// =============================================================================
// § Rate Limiter
// =============================================================================

export class RateLimiter {
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
