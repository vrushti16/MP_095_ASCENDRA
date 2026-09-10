const redisConfig = require('../config/redis');

const DEFAULT_TTL_SECONDS = 300; // 5 minutes default
const KEY_PREFIX = 'ascendra:';

/**
 * Format key with standard application namespace
 * @param {string} key
 * @returns {string}
 */
function formatKey(key) {
  return key.startsWith(KEY_PREFIX) ? key : `${KEY_PREFIX}${key}`;
}

/**
 * Retrieve a cached value by key.
 * Returns parsed JSON object or primitive, or null on cache miss / Redis unavailability.
 *
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function get(key) {
  if (!redisConfig.isRedisAvailable()) {
    return null; // Graceful cache miss
  }

  try {
    const client = redisConfig.getRedisClient();
    const rawData = await client.get(formatKey(key));

    if (!rawData) {
      return null;
    }

    try {
      return JSON.parse(rawData);
    } catch {
      return rawData;
    }
  } catch (err) {
    // Redis read failure degrades gracefully to cache miss
    return null;
  }
}

/**
 * Store a value in cache with a defined Time-To-Live (TTL).
 * Serializes objects to JSON safely.
 *
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlSeconds=300]
 * @returns {Promise<boolean>} True if stored successfully
 */
async function set(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!redisConfig.isRedisAvailable() || value === undefined) {
    return false;
  }

  try {
    const client = redisConfig.getRedisClient();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const ttl = Math.max(1, parseInt(ttlSeconds, 10) || DEFAULT_TTL_SECONDS);

    await client.set(formatKey(key), serialized, {
      EX: ttl
    });
    return true;
  } catch (err) {
    // Redis write failure degrades gracefully without throwing
    return false;
  }
}

/**
 * Delete a specific key from cache
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function del(key) {
  if (!redisConfig.isRedisAvailable()) {
    return false;
  }

  try {
    const client = redisConfig.getRedisClient();
    await client.del(formatKey(key));
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Invalidate a key or a collection of keys matching a prefix/pattern
 * @param {string} patternOrKey
 * @returns {Promise<number>} Number of keys removed
 */
async function invalidate(patternOrKey) {
  if (!redisConfig.isRedisAvailable()) {
    return 0;
  }

  try {
    const client = redisConfig.getRedisClient();
    const fullPattern = formatKey(patternOrKey);

    // If exact key
    if (!patternOrKey.includes('*')) {
      const removed = await client.del(fullPattern);
      return removed;
    }

    // Pattern matching using scanIterator
    let count = 0;
    const keysToDelete = [];

    for await (const key of client.scanIterator({ MATCH: fullPattern, COUNT: 100 })) {
      keysToDelete.push(key);
      count++;
    }

    if (keysToDelete.length > 0) {
      await client.del(keysToDelete);
    }

    return count;
  } catch (err) {
    return 0;
  }
}

/**
 * Check if a key exists in cache
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function exists(key) {
  if (!redisConfig.isRedisAvailable()) {
    return false;
  }

  try {
    const client = redisConfig.getRedisClient();
    const result = await client.exists(formatKey(key));
    return result === 1;
  } catch (err) {
    return false;
  }
}

module.exports = {
  get,
  set,
  delete: del,
  del,
  invalidate,
  exists,
  formatKey,
  DEFAULT_TTL_SECONDS
};
