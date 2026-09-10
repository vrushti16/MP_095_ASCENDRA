const axios = require('axios');
const database = require('../config/database');
const redisConfig = require('../config/redis');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const HEALTH_TIMEOUT_MS = 2500;

/**
 * Perform health probe on PostgreSQL database
 */
async function checkPostgresHealth() {
  const start = Date.now();
  try {
    await database.query('SELECT 1 AS health_check;');
    const latencyMs = Date.now() - start;
    return {
      status: 'healthy',
      latencyMs,
      error: null
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      latencyMs: null,
      error: 'Database connection failed'
    };
  }
}

/**
 * Perform health probe on Redis Cache service
 */
async function checkRedisHealth() {
  try {
    const result = await redisConfig.testRedisConnection();
    return {
      status: result.status, // 'healthy' | 'unavailable' | 'degraded'
      latencyMs: result.latencyMs,
      fallbackState: result.fallbackState,
      error: result.error ? 'Redis connection unavailable' : null
    };
  } catch (err) {
    return {
      status: 'unavailable',
      latencyMs: null,
      fallbackState: 'cache_bypass',
      error: 'Redis probe failure'
    };
  }
}

/**
 * Perform health probe on FastAPI AI microservice
 */
async function checkFastApiHealth() {
  const start = Date.now();
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/api/v1/health`, {
      timeout: HEALTH_TIMEOUT_MS,
      headers: { Accept: 'application/json' }
    });
    const latencyMs = Date.now() - start;

    return {
      status: response.status === 200 ? 'healthy' : 'degraded',
      latencyMs,
      specVersion: response.data?.specVersion || '1.0.0',
      error: null
    };
  } catch (err) {
    return {
      status: 'unavailable',
      latencyMs: null,
      fallbackState: 'development_catalog_or_bypass',
      error: 'AI service unreachable'
    };
  }
}

/**
 * Standard lightweight health check
 */
function getBasicHealth() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  };
}

/**
 * Deep diagnostic health check aggregating Node.js, PostgreSQL, Redis, and FastAPI
 */
async function getDetailedHealth() {
  const mem = process.memoryUsage();

  // Run probes concurrently with bounded timeouts
  const [postgres, redis, fastapi] = await Promise.all([
    checkPostgresHealth(),
    checkRedisHealth(),
    checkFastApiHealth()
  ]);

  // Overall system health calculation:
  // - 'healthy': Postgres, Redis, and FastAPI all healthy
  // - 'degraded': Postgres healthy, but Redis and/or FastAPI degraded/unavailable
  // - 'unhealthy': Postgres (authoritative storage) down
  let overallStatus = 'healthy';
  let httpStatusCode = 200;

  if (postgres.status !== 'healthy') {
    overallStatus = 'unhealthy';
    httpStatusCode = 503; // Service Unavailable
  } else if (redis.status !== 'healthy' || fastapi.status !== 'healthy') {
    overallStatus = 'degraded';
    httpStatusCode = 200; // API remains fully operational via fallback
  }

  return {
    httpStatusCode,
    payload: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'ascendra-backend',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      runtime: {
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memory: {
          heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
          rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100
        }
      },
      dependencies: {
        postgresql: {
          status: postgres.status,
          latencyMs: postgres.latencyMs,
          error: postgres.error
        },
        redis: {
          status: redis.status,
          latencyMs: redis.latencyMs,
          fallbackState: redis.fallbackState,
          error: redis.error
        },
        fastapi: {
          status: fastapi.status,
          latencyMs: fastapi.latencyMs,
          specVersion: fastapi.specVersion,
          error: fastapi.error
        }
      }
    }
  };
}

module.exports = {
  checkPostgresHealth,
  checkRedisHealth,
  checkFastApiHealth,
  getBasicHealth,
  getDetailedHealth
};
