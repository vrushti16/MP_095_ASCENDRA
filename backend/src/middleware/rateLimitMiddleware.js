const redisConfig = require('../config/redis');
const { sendError } = require('../utils/apiResponse');

/**
 * Lightweight, resilient rate limiting middleware with Redis backing
 * and graceful in-memory sliding-window fallback.
 *
 * Designed defensively for high availability:
 * - Redis-backed when Redis is connected
 * - In-memory sliding window when Redis is offline
 * - Test isolation support via x-test-client-id header in test environment
 * - Exposes reset() method for deterministic QA testing
 */
function createRateLimiter({
  windowMs = 60 * 1000,
  maxRequests = 10,
  keyPrefix = 'rl:default:'
}) {
  // In-memory sliding window store: Map<key, Array<number>>
  const memoryStore = new Map();

  // Periodic memory cleanup every 60s
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of memoryStore.entries()) {
      const validTimestamps = timestamps.filter(t => now - t < windowMs);
      if (validTimestamps.length === 0) {
        memoryStore.delete(key);
      } else {
        memoryStore.set(key, validTimestamps);
      }
    }
  }, Math.max(10000, windowMs));

  // Unref timer so it doesn't block Node.js process exit
  if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  function getClientKey(req) {
    // In test environment only, permit test isolation via header
    if (process.env.NODE_ENV === 'test' && req.headers['x-test-client-id']) {
      return `${keyPrefix}${req.headers['x-test-client-id']}`;
    }
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    return `${keyPrefix}${ip}`;
  }

  const middleware = async (req, res, next) => {
    const key = getClientKey(req);
    const now = Date.now();

    // 1. Try Redis first if online
    if (redisConfig.isRedisAvailable()) {
      try {
        const client = redisConfig.getRedisClient();
        const fullKey = `ascendra:${key}`;

        // Increment hit count
        const hits = await client.incr(fullKey);
        if (hits === 1) {
          // Set TTL on new key
          await client.pExpire(fullKey, windowMs);
        }

        const ttlMs = await client.pTTL(fullKey);
        const retryAfterSeconds = Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : windowMs) / 1000));

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - hits));
        res.setHeader('X-RateLimit-Reset', Math.ceil((now + (ttlMs > 0 ? ttlMs : windowMs)) / 1000));

        if (hits > maxRequests) {
          res.setHeader('Retry-After', retryAfterSeconds);
          return sendError(
            res,
            'Too many requests. Please slow down and try again later.',
            'TOO_MANY_REQUESTS',
            429
          );
        }

        return next();
      } catch {
        // Fall back to in-memory store if Redis command fails
      }
    }

    // 2. In-Memory Sliding Window Fallback
    let timestamps = memoryStore.get(key) || [];
    timestamps = timestamps.filter(t => now - t < windowMs);

    const hits = timestamps.length + 1;
    timestamps.push(now);
    memoryStore.set(key, timestamps);

    const oldestTimestamp = timestamps[0];
    const timeUntilReset = Math.max(0, windowMs - (now - oldestTimestamp));
    const retryAfterSeconds = Math.max(1, Math.ceil(timeUntilReset / 1000));

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - hits));
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + timeUntilReset) / 1000));

    if (hits > maxRequests) {
      res.setHeader('Retry-After', retryAfterSeconds);
      return sendError(
        res,
        'Too many requests. Please slow down and try again later.',
        'TOO_MANY_REQUESTS',
        429
      );
    }

    return next();
  };

  // Reset method for testing and administrative maintenance
  middleware.reset = async () => {
    memoryStore.clear();
    if (redisConfig.isRedisAvailable()) {
      try {
        const client = redisConfig.getRedisClient();
        for await (const k of client.scanIterator({ MATCH: `ascendra:${keyPrefix}*`, COUNT: 100 })) {
          await client.del(k);
        }
      } catch {
        // Ignore
      }
    }
  };

  return middleware;
}

// Pre-configured rate limiters for auth routes
const loginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'rl:login:'
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  keyPrefix: 'rl:register:'
});

module.exports = {
  createRateLimiter,
  loginLimiter,
  registerLimiter
};
