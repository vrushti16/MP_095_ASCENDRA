const { createClient } = require('redis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client = null;
let connectionState = 'disconnected'; // 'disconnected' | 'connecting' | 'connected' | 'unavailable'
let lastErrorLoggedTime = 0;
const ERROR_LOG_THROTTLE_MS = 15000; // Prevent log flooding if Redis is offline

/**
 * Configure reconnection strategy with bounded exponential backoff
 */
function reconnectStrategy(retries) {
  if (process.env.NODE_ENV === 'test') {
    // In test environment, don't keep reconnecting indefinitely
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
      connectTimeout: 3000
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
    connectionState = 'unavailable';
    const now = Date.now();
    // Throttle error logging to prevent console spam
    if (now - lastErrorLoggedTime > ERROR_LOG_THROTTLE_MS) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`⚠️ [REDIS WARNING] Redis unavailable at ${REDIS_URL.split('@').pop()}: ${err.message}. Running in cache-bypass mode.`);
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
  const redisInstance = getRedisClient();

  if (redisInstance.isOpen) {
    return true;
  }

  try {
    connectionState = 'connecting';
    await redisInstance.connect();
    connectionState = 'connected';
    return true;
  } catch (err) {
    connectionState = 'unavailable';
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`⚠️ [REDIS] Could not establish connection on startup (${err.message}). Application will operate without cache.`);
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
