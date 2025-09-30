/**
 * Simple in-memory rate limiter for API endpoints
 * For production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitConfig {
  uniqueTokenPerInterval: number;
  interval: number;
}

class RateLimiter {
  private tokenCache = new Map<string, number[]>();

  check(identifier: string, limit: number, windowMs: number): {
    success: boolean;
    remaining: number;
    resetAt: number;
  } {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing timestamps for this identifier
    const timestamps = this.tokenCache.get(identifier) || [];

    // Filter out timestamps outside the current window
    const validTimestamps = timestamps.filter(ts => ts > windowStart);

    // Check if limit is exceeded
    if (validTimestamps.length >= limit) {
      const oldestTimestamp = validTimestamps[0];
      const resetAt = oldestTimestamp + windowMs;
      
      return {
        success: false,
        remaining: 0,
        resetAt,
      };
    }

    // Add current timestamp
    validTimestamps.push(now);
    this.tokenCache.set(identifier, validTimestamps);

    // Clean up old entries periodically
    if (this.tokenCache.size > 10000) {
      this.cleanup(windowStart);
    }

    return {
      success: true,
      remaining: limit - validTimestamps.length,
      resetAt: now + windowMs,
    };
  }

  private cleanup(before: number) {
    for (const [key, timestamps] of this.tokenCache.entries()) {
      const valid = timestamps.filter(ts => ts > before);
      if (valid.length === 0) {
        this.tokenCache.delete(key);
      } else {
        this.tokenCache.set(key, valid);
      }
    }
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

export function checkRateLimit(
  identifier: string,
  limit: number = 20, // 20 requests
  windowMs: number = 60000 // per minute
): {
  success: boolean;
  remaining: number;
  resetAt: number;
} {
  return rateLimiter.check(identifier, limit, windowMs);
} 