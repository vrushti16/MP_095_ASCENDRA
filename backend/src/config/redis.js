const { createClient } = require('redis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Check if Redis is enabled via environment variable (defaults to true if not explicitly set to 'false')
 */
function isRedisConfiguredEnabled() {
  return process.env.REDIS_ENABLED !== 'false' && process.env.ENABLE_REDIS !== 'false';
}

let client = null;
let connectionState = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'unavailable'
let lastErrorLoggedTime = 0;
const ERROR_LOG_THROTTLE_MS = 15000; // Prevent log flooding if Redis is offline

/**
 * Configure reconnection strategy with bounded exponential backoff
 */
function reconnectStrategy(retries) {
  if (process.env.NODE_ENV === 'test' || retries >= 2 || !isRedisConfiguredEnabled()) {
    // Do not keep retrying indefinitely when Redis is offline or disabled
    return false;
  }
  // Max retry delay of 3000ms
  const delay = Math.min(retries * 200, 3000);
  return delay;
}

/**
 * Initialize and return the Redis client singleton
 */
function getRedisClient() {
  if (client) {
    return client;
  }

  // Create official Redis client
  client = createClient({
    url: REDIS_URL,
    socket: {
      reconnectStrategy,
      connectTimeout: 1000
    }
  });

  client.on('connect', () => {
    connectionState = 'connecting';
  });

  client.on('ready', () => {
    connectionState = 'connected';
    if (process.env.NODE_ENV !== 'test') {
      console.log('✅ [REDIS] Connected to Redis cache service.');
    }
  });

  client.on('reconnecting', () => {
    connectionState = 'connecting';
  });

  client.on('end', () => {
    connectionState = 'disconnected';
  });

  client.on('error', (err) => {
    const wasConnected = connectionState === 'connected';
    connectionState = 'unavailable';
    const now = Date.now();
    // Only log if connection was active and unexpectedly lost
    if (wasConnected && now - lastErrorLoggedTime > ERROR_LOG_THROTTLE_MS) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`ℹ️ [REDIS] Connection dropped: ${err.message}. Running in cache-bypass mode.`);
      }
      lastErrorLoggedTime = now;
    }
  });

  return client;
}

/**
 * Connect to Redis gracefully. Never throws or crashes the host process.
 */
async function connectRedis() {
  if (!isRedisConfiguredEnabled()) {
    connectionState = 'unavailable';
    if (process.env.NODE_ENV !== 'test') {
      console.log('ℹ️ [REDIS] Cache service disabled via configuration (cache-bypass mode active).');
    }
    return false;
  }

  const redisInstance = getRedisClient();

  if (redisInstance.isOpen) {
    return true;
  }

  try {
    connectionState = 'connecting';
    await Promise.race([
      redisInstance.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 1000))
    ]);
    connectionState = 'connected';
    return true;
  } catch (err) {
    connectionState = 'unavailable';
    if (process.env.NODE_ENV !== 'test') {
      console.log(`ℹ️ [REDIS] Cache offline at ${REDIS_URL.split('@').pop()} (${err.message}). Running in cache-bypass mode.`);
    }
    return false;
  }
}

/**
 * Check whether Redis is currently online and ready to accept commands
 * @returns {boolean}
 */
function isRedisAvailable() {
  return Boolean(client && client.isOpen && connectionState === 'connected');
}

/**
 * Measure Redis ping round-trip latency and report diagnostic health
 * @returns {Promise<{ ok: boolean, status: string, latencyMs: number | null, fallbackState: string, error?: string }>}
 */
async function testRedisConnection() {
  if (!module.exports.isRedisAvailable()) {
    return {
      ok: false,
      status: 'unavailable',
      latencyMs: null,
      fallbackState: 'cache_bypass'
    };
  }

  const start = Date.now();
  try {
    const activeClient = module.exports.getRedisClient();
    const reply = await activeClient.ping();
    const latencyMs = Date.now() - start;
    return {
      ok: reply === 'PONG',
      status: reply === 'PONG' ? 'healthy' : 'degraded',
      latencyMs,
      fallbackState: 'none'
    };
  } catch (err) {
    return {
      ok: false,
      status: 'unavailable',
      latencyMs: null,
      fallbackState: 'cache_bypass',
      error: err.message
    };
  }
}

/**
 * Cleanly disconnect Redis upon application shutdown
 */
async function disconnectRedis() {
  if (client && client.isOpen) {
    try {
      await client.quit();
    } catch (err) {
      // Ignore errors on termination
    }
  }
  connectionState = 'disconnected';
}

module.exports = {
  getRedisClient,
  connectRedis,
  isRedisAvailable,
  testRedisConnection,
  disconnectRedis
};
